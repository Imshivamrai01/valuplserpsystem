import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import Item from "@/models/Item";
import Estimate from "@/models/Estimate";
import DeletedInvoice from "@/models/DeletedInvoice";
import AuditLog from "@/models/AuditLog";
import { derivePaymentModeLabel, isCollectedMode } from "@/lib/payment-modes";
import { getActor } from "@/lib/requirePermission";
import { authoriseDestructiveAction } from "@/lib/destructiveAction";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const warehouse = searchParams.get("warehouse") || searchParams.get("location");
    
    await connectToDatabase();
    
    const query: any = type ? { type } : { type: { $ne: "sales-order" } };

    // Invoices are not tagged with a warehouse anywhere in the billing flow, so a
    // strict location filter matched nothing and returned an empty list — the branch
    // selector defaults to "Main Central Warehouse", which hid every bill in the app.
    // Filter only when it actually selects something; otherwise show the full ledger.
    const SHOWROOM_PATTERN = /showroom|ashoka|kunraghat|vp-?kun|main\s*store/i;
    let warehouseScoped = false;

    if (warehouse && warehouse !== "all") {
      const escaped = warehouse.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const locationClause = SHOWROOM_PATTERN.test(warehouse)
        ? [
            { warehouse: { $exists: false } },
            { warehouse: "" },
            { warehouse: null },
            { warehouse: { $regex: SHOWROOM_PATTERN } },
          ]
        : [
            { warehouse: { $regex: new RegExp(`^${escaped}$`, "i") } },
            { branchName: { $regex: new RegExp(`^${escaped}$`, "i") } },
          ];

      const scopedCount = await Invoice.countDocuments({ ...query, $or: locationClause });
      if (scopedCount > 0) {
        query.$or = locationClause;
        warehouseScoped = true;
      }
    }

    const invoices = await Invoice.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({
      success: true,
      data: invoices,
      warehouseScoped,
      warehouseRequested: warehouse || "all",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();
    
    // 1. Customer Auto-Add Logic & Offline Sync Reconciliation
    //
    // A problem here must never lose the bill. Previously an exception thrown while
    // creating the customer (an address field failing validation, a duplicate code
    // under concurrent billing) propagated out and failed the whole POST with a 400,
    // so the invoice was never written even though the counter had taken the money.
    if (body.customerId === "new" || !body.customerId || body.customerId.startsWith("OFFLINE-CUST-")) {
      try {
        let matchedCust = body.customerPhone ? await Customer.findOne({ phone: body.customerPhone }) : null;
        if (!matchedCust) {
          // Derive the code from the highest existing one rather than the document
          // count, so a deleted customer can't cause a duplicate-key collision.
          const last = await Customer.findOne({ code: /^CUST-\d+$/ }).sort({ code: -1 }).lean();
          const lastNum = last?.code ? parseInt(String(last.code).replace("CUST-", ""), 10) || 0 : 0;
          const custCode = `CUST-${String(lastNum + 1).padStart(3, "0")}`;

          matchedCust = await Customer.create({
            code: custCode,
            name: body.customerName || "Walk-in Customer",
            phone: body.customerPhone || "0000000000",
            email: body.customerEmail || "",
            gstNumber: body.customerGST || "",
            billingAddress: {
              line1: body.customerAddress || "Address not provided",
              city: body.customerCity || "City Not Specified",
              state: body.placeOfSupply ? body.placeOfSupply.replace(/ —.*$/, '').replace(/ \(\d+\)/, '').trim() : "Unknown",
              pincode: body.customerPin || "",
              country: "India"
            }
          });
        }
        body.customerId = matchedCust._id.toString();
      } catch (custErr: any) {
        // Fall back to a synthetic id so the sale is still recorded; the bill matters
        // more than the customer master row, and the name/phone are on the invoice.
        console.error("Customer auto-add failed, saving invoice anyway:", custErr?.message);
        body.customerId = body.customerId && !String(body.customerId).startsWith("OFFLINE-CUST-")
          ? body.customerId
          : new mongoose.Types.ObjectId().toString();
      }
    }
    
    // 2. Number collision handling.
    //
    // This dedupe exists so an offline bill re-posted on reconnect isn't duplicated.
    // But it used to return the stored invoice for ANY number match, so when the
    // client generated a number that already existed the counter got {success:true}
    // plus somebody else's older bill — the new sale was silently discarded and
    // never appeared in the list or on the dashboard.
    //
    // A genuine resync is the same bill: same customer, same amount, same date.
    // Anything else is a fresh sale that merely collided, and must get its own
    // number rather than being thrown away.
    let numberReassignedFrom: string | null = null;
    const existingInvoice: any = await Invoice.findOne({ invoiceNumber: body.invoiceNumber }).lean();
    if (existingInvoice) {
      const sameBill =
        String(existingInvoice.customerPhone || "") === String(body.customerPhone || "") &&
        Math.abs(Number(existingInvoice.total || 0) - Number(body.total || 0)) < 1 &&
        String(existingInvoice.date || "").slice(0, 10) === String(body.date || "").slice(0, 10);

      if (sameBill) {
        return NextResponse.json({ success: true, data: existingInvoice, message: "Invoice already synced" });
      }

      // Collision: allocate the next free number from the database.
      const prefixMatch = String(body.invoiceNumber || "").match(/^([A-Za-z0-9-]*?)(\d+)(-\d+)?$/);
      const prefix = prefixMatch ? prefixMatch[1] : "SVAK2026RI";
      const width = prefixMatch ? prefixMatch[2].length : 5;
      const siblings = await Invoice.find(
        { invoiceNumber: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\d+` } },
        { invoiceNumber: 1 }
      ).lean();
      let max = 0;
      for (const s of siblings as any[]) {
        const d = String(s.invoiceNumber).slice(prefix.length).match(/^\d+/);
        if (d) max = Math.max(max, parseInt(d[0], 10) || 0);
      }
      const reassigned = `${prefix}${String(max + 1).padStart(width, "0")}`;
      console.warn(
        `Invoice number ${body.invoiceNumber} already belongs to a different bill; reassigned to ${reassigned}`
      );
      numberReassignedFrom = body.invoiceNumber;
      body.invoiceNumber = reassigned;
    }

    // Generate 4-digit Delivery OTP if delayed delivery is chosen
    if (body.dispatchType === "delayed_delivery" && !body.deliveryOtp) {
      body.deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
      body.deliveryStatus = "pending_dispatch";
    }

    // ─── SPLIT PAYMENT NORMALISATION ────────────────────────────────────────
    // A bill can be settled across several modes (₹10,000 cash + ₹40,000 online).
    // The rows are the source of truth, so paymentMode/paidAmount/balanceAmount are
    // derived here rather than trusted from the client. Invoices posted without a
    // `payments` array are untouched and behave exactly as before.
    const splitRows = Array.isArray(body.payments)
      ? body.payments
          .map((p: any) => ({
            mode: String(p?.mode || "Cash"),
            amount: Math.max(0, Number(p?.amount) || 0),
            txnId: p?.txnId || "",
            reference: p?.reference || "",
            receivedBy: p?.receivedBy || "",
            notes: p?.notes || "",
          }))
          .filter((p: any) => p.amount > 0)
      : [];

    const isSplitInvoice = splitRows.length > 1;

    if (splitRows.length > 0) {
      const invoiceTotal = Number(body.total) || 0;
      const allocated = splitRows.reduce((s: number, p: any) => s + p.amount, 0);
      // Allow a rupee of tolerance for GST rounding, but reject a genuine mismatch
      // rather than silently saving a bill whose parts do not add up.
      if (Math.abs(allocated - invoiceTotal) > 1) {
        return NextResponse.json(
          {
            success: false,
            error: `Split payments (₹${allocated.toFixed(2)}) do not match the invoice total (₹${invoiceTotal.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }

      body.payments = splitRows;
      body.paymentMode = derivePaymentModeLabel(splitRows);
      // Only Cash/UPI/Card/Online are money in hand. Finance and Due rows are
      // receivables and stay in the balance, matching how financeDownPayment and
      // dueAdvanceAmount have always behaved.
      const collected = splitRows
        .filter((p: any) => isCollectedMode(p.mode))
        .reduce((s: number, p: any) => s + p.amount, 0);
      body.paidAmount = collected;
      body.balanceAmount = Math.max(0, invoiceTotal - collected);
      if (body.balanceAmount <= 1 && collected > 0) body.status = body.status === "draft" ? "draft" : "paid";
      else if (collected > 0) body.status = body.status === "draft" ? "draft" : "partial";
    }

    const invoice = await Invoice.create(body);

    try {
      // 2.5 Create Payment Transaction if paidAmount > 0
      //
      // Skipped for split invoices: the per-mode breakdown already lives on the
      // invoice, and a single receipt could only carry one mode ("Multiple"), which
      // the dashboard's receipt loop would bucket entirely as Online. Single-mode
      // invoices still create their receipt exactly as before.
      if (body.paidAmount > 0 && !isSplitInvoice) {
        const PaymentTransaction = (await import("@/models/PaymentTransaction")).default;
        await PaymentTransaction.create({
          transactionId: `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          partyId: invoice.customerId,
          partyType: "Customer",
          partyName: invoice.customerName,
          amount: body.paidAmount,
          // For a Finance sale, the amount actually collected here is the customer's down
          // payment — tag it with however that down payment was really collected, not "Finance".
          paymentMode: body.financeProvider ? (body.financeDownPaymentMode || body.downPaymentMode || "Cash") : (body.paymentMode || "Cash"),
          date: body.date || new Date().toISOString().split("T")[0],
          referenceId: invoice.invoiceNumber,
          notes: invoice.type === 'credit-note' ? `Refund for Credit Note ${invoice.invoiceNumber}` : `Initial payment for ${invoice.type === 'sales-order' ? 'order' : 'invoice'} ${invoice.invoiceNumber}`,
          type: invoice.type === 'credit-note' ? "paid" : "received"
        });
      }
      
      // 3. Update Customer Balance and Master Data
      const updateData: any = {};
      if (body.balanceAmount > 0) {
        updateData.$inc = { 
          outstandingBalance: body.type === "credit-note" ? -body.balanceAmount : body.balanceAmount 
        };
      }
      
      if (body.customerId && body.customerId !== "new" && body.customerPin) {
        if (!updateData.$set) updateData.$set = {};
        updateData.$set["billingAddress.pincode"] = body.customerPin;
      }

      if (Object.keys(updateData).length > 0) {
        await Customer.findByIdAndUpdate(body.customerId, updateData);
      }

      // 4. Inventory Stock Deduction & Serial Number Status Update
      if (body.type !== "proforma") {
        if (body.items && body.items.length > 0) {
          for (const item of body.items) {
            // Deduct / add stock
            if (item.itemId && (item.itemId.length === 24 || item.itemId.length > 10)) {
              await Item.findByIdAndUpdate(item.itemId, {
                $inc: { currentStock: body.type === "credit-note" ? item.quantity : -item.quantity },
              });
            }

            // Lock Serial Number if serialized item was sold
            if (item.serialNumber && body.type !== "credit-note") {
              const SerialNumber = (await import("@/models/SerialNumber")).default;
              await SerialNumber.findOneAndUpdate(
                { serialNumber: item.serialNumber },
                {
                  status: "SOLD",
                  invoiceId: invoice._id.toString(),
                  invoiceNumber: invoice.invoiceNumber,
                  customerName: invoice.customerName,
                  customerPhone: invoice.customerPhone || "",
                  soldDate: invoice.date,
                  $push: {
                    history: {
                      action: "Sold via Tax Invoice",
                      date: new Date(),
                      performedBy: invoice.salesExecutive || "Sales Team",
                      details: `Invoice #${invoice.invoiceNumber}`,
                    },
                  },
                }
              );
            }

            // Record Extended Warranty if purchased
            if (item.extendedWarrantyPlan && (item.extendedWarrantyAmount || 0) > 0) {
              const ExtendedWarranty = (await import("@/models/ExtendedWarranty")).default;
              const duration = item.extendedWarrantyDuration || 12;
              const startDate = invoice.date;
              const startObj = new Date(startDate);
              startObj.setMonth(startObj.getMonth() + duration);
              const endDate = startObj.toISOString().split("T")[0];

              // Field names here must match models/ExtendedWarranty.ts exactly —
              // this used to write policyNumber/invoiceId/customerId/itemName/
              // provider, none of which exist on that schema (it wants
              // warrantyId/productName/vpCode instead), so every one of these
              // .create() calls failed validation and the invoice save silently
              // ended up warranty-less.
              const warrantyCount = await ExtendedWarranty.countDocuments();
              const warrantyId = `EW-2026-${String(warrantyCount + 1).padStart(4, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
              await ExtendedWarranty.create({
                warrantyId,
                invoiceNumber: invoice.invoiceNumber,
                customerName: invoice.customerName,
                customerPhone: invoice.customerPhone || "",
                itemId: item.itemId,
                productName: item.itemName,
                vpCode: item.vpCode || item.itemCode || "",
                serialNumber: item.serialNumber || "",
                planName: item.extendedWarrantyPlan,
                durationMonths: duration,
                startDate,
                endDate,
                warrantyAmount: item.extendedWarrantyAmount,
                salesStaff: invoice.salesExecutive || "Amit Singh",
                status: "Active",
                remarks: item.extendedWarrantyPolicyNo
                  ? `Provider policy #: ${item.extendedWarrantyPolicyNo}`
                  : "",
              });
            }
          }
        }
      }

      // 4.5 Auto-generate Delivery Challan if delayed delivery or vehicle number provided
      if (body.dispatchType === "delayed_delivery" || body.vehicleNumber || body.createChallan) {
        const DeliveryChallan = (await import("@/models/DeliveryChallan")).default;
        const count = await DeliveryChallan.countDocuments();
        const challanNo = `DC-2026-${String(count + 1).padStart(4, "0")}`;
        const firstItem = body.items?.[0];
        
        await DeliveryChallan.create({
          challanNo,
          type: "Outward Delivery",
          invoiceNumber: invoice.invoiceNumber,
          sourceParty: "M/S ASHOKA ENTERPRISES",
          sourceAddress: "H. NO. 116, NEAR SHANTI MARRIAGE HOUSE DEORIA ROAD, KUNRAGHAT GORAKHPUR",
          destinationParty: invoice.customerName,
          destinationAddress: body.shippingAddress || invoice.customerAddress || invoice.customerCity || "Gorakhpur",
          customerPhone: invoice.customerPhone || "",
          itemName: firstItem?.itemName || "Assorted Products",
          vpCode: firstItem?.vpCode || firstItem?.itemCode || "",
          hsn: firstItem?.hsnCode || firstItem?.hsn || "8528",
          serialImei: body.items?.map((it: any) => it.serialNumber).filter(Boolean).join(", ") || "",
          quantity: body.items?.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0) || 1,
          unit: firstItem?.unit || "PCS",
          financeDoId: body.financeDoId || "",
          reason: body.dispatchType === "delayed_delivery" ? "Home Delivery Dispatch / Godown Delivery" : "Tax Invoice Dispatch",
          date: new Date(),
          vehicleNo: body.vehicleNumber || "",
          driverName: body.driverName || "Delivery Team",
          driverPhone: body.driverPhone || "",
          deliveryOtp: invoice.deliveryOtp || "",
          status: body.dispatchType === "delayed_delivery" ? "in-transit" : "delivered",
        });

        invoice.deliveryChallanNo = challanNo;
        await invoice.save();
      }

      // 4.6 Register Finance Transaction ONLY if Payment Mode is Finance
      if (body.paymentMode === "Finance") {
        const FinanceTransaction = (await import("@/models/FinanceTransaction")).default;
        const doId = body.financeDoId || `DO-2026-${Math.floor(100000000 + Math.random() * 900000000)}`;
        
        const existingDO = await FinanceTransaction.findOne({ doId });
        if (!existingDO) {
          const grossLoan = Number(body.financeGrossLoan || body.total || 0);
          const downPayment = Number(body.downPayment || body.financeDownPayment || 0);
          const subsidy = Number(body.financeDealerSubsidy || Math.round(grossLoan * 0.0354));
          const deductions = downPayment + subsidy + 270; // Matching typical DO calculations
          const netDisb = Math.max(0, grossLoan - deductions);

          await FinanceTransaction.create({
            financeProvider: body.financeProvider || "Bajaj Finance Limited",
            customerName: invoice.customerName,
            customerMobile: invoice.customerPhone || "N/A",
            deliveryAddress: invoice.customerAddress || "Gorakhpur, Uttar Pradesh",
            invoiceNumber: invoice.invoiceNumber,
            atosDealId: body.financeAppId || `CS${Date.now()}`,
            doId,
            date: invoice.date,
            assetCategory: body.items?.[0]?.category || "Electronics",
            oemCategory: body.items?.[0]?.itemName || "Electronics",
            manufacturer: body.items?.[0]?.brand || "Havells (Lloyd)",
            brand: body.items?.[0]?.brand || "Havells (Lloyd)",
            model: body.items?.[0]?.itemName || "",
            productModel: body.items?.[0]?.itemName || "",
            productPrice: invoice.total,
            grossLoanAmount: grossLoan,
            netLoanAmount: grossLoan,
            marginMoney: 0,
            advanceEmi: 0,
            dealerInterestSubsidy: subsidy,
            totalGst: 118,
            convenienceFee: 270,
            customerDownPayment: downPayment,
            totalDeductions: deductions,
            netDisbursement: netDisb,
            approvalStatus: body.financeApprovalStatus || "Pending",
            uploadedPdfUrl: body.financePdfUrl || "",
          });
        }
      }

      // 5. Update Estimate Status & Auto-Attribute Sale to Salesperson
      if (body.linkedEstimateNumber) {
        const matchedEst = await Estimate.findOne({ estimateNumber: body.linkedEstimateNumber });
        if (matchedEst) {
          matchedEst.status = "Converted";
          matchedEst.convertedInvoiceNumber = invoice.invoiceNumber;
          await matchedEst.save();

          if ((!invoice.salesExecutive || invoice.salesExecutive === "Admin" || invoice.salesExecutive === "Store Staff") && (matchedEst.salesperson || matchedEst.salesExecutive)) {
            invoice.salesExecutive = matchedEst.salesperson || matchedEst.salesExecutive;
            invoice.createdBy = matchedEst.salesperson || matchedEst.salesExecutive;
            await invoice.save();
          }
        }
      } else {
        const phoneDigits = (invoice.customerPhone || "").replace(/\D/g, "");
        if (phoneDigits && phoneDigits.length >= 10) {
          const matchedEst = await Estimate.findOne({
            customerPhone: { $regex: phoneDigits.slice(-10) },
            status: { $ne: "Converted" }
          });
          if (matchedEst) {
            matchedEst.status = "Converted";
            matchedEst.convertedInvoiceNumber = invoice.invoiceNumber;
            await matchedEst.save();

            if ((!invoice.salesExecutive || invoice.salesExecutive === "Admin" || invoice.salesExecutive === "Store Staff") && (matchedEst.salesperson || matchedEst.salesExecutive)) {
              invoice.salesExecutive = matchedEst.salesperson || matchedEst.salesExecutive;
              invoice.createdBy = matchedEst.salesperson || matchedEst.salesExecutive;
              await invoice.save();
            }
          }
        }
      }

      // 6. Auto-Convert matching Walk-in/CRM Leads upon Customer Purchase
      if (invoice.type !== "credit-note") {
        try {
          const Lead = (await import("@/models/Lead")).default;
          const phoneDigits = (invoice.customerPhone || "").replace(/\D/g, "");
          const leadFilter: any = {
            status: { $in: ["New", "Contacted", "Interested", "Follow-up"] },
          };

          if (phoneDigits && phoneDigits.length >= 10) {
            leadFilter.mobile = { $regex: phoneDigits.slice(-10) };
          } else if (invoice.customerName && invoice.customerName !== "Cash Customer" && invoice.customerName !== "Cash Guest") {
            leadFilter.customerName = { $regex: new RegExp(`^${invoice.customerName.trim()}$`, "i") };
          }

          const matchedLeads = await Lead.find(leadFilter);
          for (const lead of matchedLeads) {
            lead.status = "Converted";
            lead.convertedInvoiceNumber = invoice.invoiceNumber;
            lead.timeline.push({
              date: new Date(),
              action: `Auto-Converted on Invoice #${invoice.invoiceNumber}`,
              notes: `Customer completed purchase of ₹${Number(invoice.total || invoice.netAmount || 0).toLocaleString("en-IN")}. Billed by ${invoice.salesExecutive || "Sales Team"}.`,
              staff: invoice.salesExecutive || "Sales Team",
            });
            await lead.save();
          }
        } catch (leadErr) {
          console.warn("Notice: Auto-lead conversion:", leadErr);
        }
      }

      // 7. Auto-Evaluate & Complete Sales Target Tasks for Sales Staff on Invoice Creation
      if (invoice.type !== "credit-note" && invoice.salesExecutive) {
        try {
          const StaffTask = (await import("@/models/StaffTask")).default;
          const salesPerson = invoice.salesExecutive.trim();
          const firstName = salesPerson.split(" ")[0];

          // Find active sales target tasks for this salesperson
          const activeTargetTasks = await StaffTask.find({
            status: { $in: ["Pending", "In Progress"] },
            taskType: "sales_target",
            $or: [
              { assignedStaff: { $regex: new RegExp(salesPerson, "i") } },
              { assignedStaff: { $regex: new RegExp(firstName, "i") } },
              { assignedStaff: "All Staff" },
              { assignedStaff: "Sales Staff" },
            ],
          });

          for (const task of activeTargetTasks) {
            let matchesTarget = false;
            let qtyIncrement = 0;
            const invoiceTotal = Number(invoice.total || invoice.netAmount || 0);

            // Check if task targets a specific product or brand
            if (task.targetProduct || task.targetBrand) {
              const targetP = (task.targetProduct || "").toLowerCase().trim();
              const targetB = (task.targetBrand || "").toLowerCase().trim();

              for (const lineItem of (invoice.items || [])) {
                const itemN = (lineItem.itemName || "").toLowerCase();
                const itemC = (lineItem.category || "").toLowerCase();
                const itemB = (lineItem.brand || "").toLowerCase();

                if ((targetP && (itemN.includes(targetP) || itemC.includes(targetP))) ||
                    (targetB && (itemB.includes(targetB) || itemN.includes(targetB)))) {
                  matchesTarget = true;
                  qtyIncrement += Number(lineItem.quantity || lineItem.qty || 1);
                }
              }
            } else {
              // General revenue/sales target
              matchesTarget = true;
              qtyIncrement = (invoice.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity || it.qty) || 1), 0);
            }

            if (matchesTarget) {
              task.currentQty = (Number(task.currentQty) || 0) + (qtyIncrement || 1);
              task.currentAmount = (Number(task.currentAmount) || 0) + invoiceTotal;
              task.status = "In Progress";
              task.linkedInvoiceNumber = invoice.invoiceNumber;

              const isQtyMet = task.targetQty ? task.currentQty >= task.targetQty : true;
              const isAmountMet = task.targetAmount ? task.currentAmount >= task.targetAmount : true;

              if (isQtyMet && isAmountMet) {
                task.status = "Completed";
                task.completedAt = new Date();
                task.completionRemarks = `Auto-completed upon generating Invoice #${invoice.invoiceNumber} (Total: ₹${invoiceTotal.toLocaleString("en-IN")})`;
              }
              await task.save();
            }
          }
        } catch (taskErr) {
          console.warn("Notice: Auto-task completion:", taskErr);
        }
      }

      // 8. Adjust / Consume Customer Advance Booking Payment (Token Pre-booking)
      const advanceAdjustedVal = Number(body.advanceAdjusted || 0);
      if (advanceAdjustedVal > 0 && invoice.type !== "credit-note") {
        try {
          const CustomerAdvance = (await import("@/models/CustomerAdvance")).default;
          const Customer = (await import("@/models/Customer")).default;

          const phoneDigits = (invoice.customerPhone || "").replace(/\D/g, "");

          // 8.1 Deduct from Customer model
          if (phoneDigits && phoneDigits.length >= 10) {
            const customerObj = await Customer.findOne({ phone: phoneDigits });
            if (customerObj) {
              customerObj.advanceBalance = Math.max(0, (customerObj.advanceBalance || 0) - advanceAdjustedVal);
              await customerObj.save();
            }
          }

          // 8.2 Adjust against active CustomerAdvance receipts
          let remainingToDeduct = advanceAdjustedVal;
          const activeAdvances = await CustomerAdvance.find({
            customerPhone: phoneDigits,
            status: { $in: ["Available", "Partially Used"] },
          }).sort({ createdAt: 1 });

          for (const adv of activeAdvances) {
            if (remainingToDeduct <= 0) break;
            const deductibleFromThis = Math.min(adv.remainingBalance, remainingToDeduct);
            adv.usedAmount = (adv.usedAmount || 0) + deductibleFromThis;
            adv.remainingBalance = Math.max(0, adv.remainingBalance - deductibleFromThis);
            if (adv.remainingBalance === 0) {
              adv.status = "Fully Adjusted";
            } else {
              adv.status = "Partially Used";
            }
            adv.linkedInvoiceNumber = invoice.invoiceNumber;
            adv.notes = `${adv.notes ? adv.notes + " | " : ""}Adjusted ₹${deductibleFromThis} on Invoice #${invoice.invoiceNumber}`;
            await adv.save();
            remainingToDeduct -= deductibleFromThis;
          }

          invoice.advanceAdjusted = advanceAdjustedVal;
          invoice.advanceReceiptNo = body.advanceReceiptNo || (activeAdvances[0]?.receiptNumber || "");
          await invoice.save();
        } catch (advErr) {
          console.warn("Notice: Advance adjustment sync:", advErr);
        }
      }

      return NextResponse.json({
        success: true,
        data: invoice,
        ...(numberReassignedFrom
          ? {
              numberReassignedFrom,
              message: `Number ${numberReassignedFrom} was already in use; this bill was saved as ${invoice.invoiceNumber}.`,
            }
          : {}),
      });
    } catch (error: any) {
      // The invoice itself is already written and the customer has been billed.
      // Deleting it because a follow-up step failed (stock decrement, serial
      // allocation, estimate linking) threw the sale away entirely — the bill
      // vanished from the list and the dashboard with no trace. Keep the record and
      // report what didn't finish so it can be reconciled.
      console.error(`Post-save step failed for ${invoice.invoiceNumber}:`, error?.message);
      return NextResponse.json({
        success: true,
        data: invoice,
        warning: `Invoice saved, but a follow-up step did not complete: ${error?.message || "unknown error"}`,
        ...(numberReassignedFrom ? { numberReassignedFrom } : {}),
      });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();
    
    if (!body.invoiceNumber) {
      return NextResponse.json({ success: false, error: "Invoice number is required for update" }, { status: 400 });
    }

    const existingInvoice = await Invoice.findOne({ invoiceNumber: body.invoiceNumber });
    if (!existingInvoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    // Special handler for clearing Due / Settlement from Dashboard
    if (body.action === "clear-due" || body.dueClearedMode) {
      // A credit note is money owed BACK to the customer, so it has no due to
      // collect. Running this flow on one recorded the refund as an inbound
      // receipt, which let the same amount reduce the customer's balance twice —
      // once as the credit note itself and once as the "receipt".
      if (existingInvoice.type === "credit-note") {
        return NextResponse.json(
          {
            success: false,
            error:
              "A credit note cannot be cleared as a due — it is money owed back to the customer. Record a refund payment against it instead.",
          },
          { status: 400 }
        );
      }

      const clearedAmount = existingInvoice.balanceAmount > 0 ? existingInvoice.balanceAmount : (body.clearedAmount || existingInvoice.total);
      
      existingInvoice.paidAmount = existingInvoice.total;
      existingInvoice.balanceAmount = 0;
      existingInvoice.status = "paid";
      existingInvoice.dueClearedAt = new Date();
      existingInvoice.dueClearedMode = body.dueClearedMode || "Cash";
      existingInvoice.dueClearedBy = body.dueClearedBy || "Counter Staff";
      existingInvoice.dueClearedNotes = body.dueClearedNotes || "Due fully settled and cleared";
      existingInvoice.dueClearedTxnId = body.dueClearedTxnId || `CLR-${Date.now()}`;
      existingInvoice.lastModifiedReason = "due-clear";

      const saved = await existingInvoice.save();

      // Deduct from customer's outstanding balance
      if (existingInvoice.customerId && clearedAmount > 0) {
        await Customer.findByIdAndUpdate(existingInvoice.customerId, {
          $inc: { outstandingBalance: -clearedAmount }
        });
      }

      // Record Payment Transaction
      try {
        const PaymentTransaction = (await import("@/models/PaymentTransaction")).default;
        await PaymentTransaction.create({
          transactionId: `TXN-DUE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          partyId: existingInvoice.customerId,
          partyType: "Customer",
          partyName: existingInvoice.customerName,
          amount: clearedAmount,
          paymentMode: body.dueClearedMode || "Cash",
          date: new Date().toISOString().split("T")[0],
          referenceId: existingInvoice.invoiceNumber,
          notes: `Due balance cleared for Invoice #${existingInvoice.invoiceNumber} via ${body.dueClearedMode || "Cash"}. Txn/Ref: ${body.dueClearedTxnId || "N/A"}`,
          type: "received"
        });
      } catch (txErr) {
        console.warn("Notice: PaymentTransaction log for due clearance:", txErr);
      }

      return NextResponse.json({ success: true, message: "Due settled and cleared successfully", data: saved });
    }

    // Soft-cancel: unlike DELETE, the invoice record survives (for audit / leakage tracking)
    if (body.action === "cancel") {
      const gate = await authoriseDestructiveAction(
        req,
        "invoice.cancel",
        body.pin,
        body.reason
      );
      if (!gate.ok) return gate.response;

      if (existingInvoice.status === "cancelled") {
        return NextResponse.json({ success: false, error: "Invoice is already cancelled" }, { status: 400 });
      }

      // Reverse customer's outstanding balance (same logic as hard delete)
      if (existingInvoice.balanceAmount > 0 && existingInvoice.customerId) {
        await Customer.findByIdAndUpdate(existingInvoice.customerId, {
          $inc: { outstandingBalance: existingInvoice.type === "credit-note" ? existingInvoice.balanceAmount : -existingInvoice.balanceAmount }
        });
      }

      // Reverse inventory stock (same logic as hard delete)
      if (existingInvoice.type !== "proforma" && existingInvoice.items && existingInvoice.items.length > 0) {
        for (const item of existingInvoice.items) {
          if (item.itemId) {
            await Item.findByIdAndUpdate(item.itemId, {
              $inc: { currentStock: existingInvoice.type === "credit-note" ? -item.quantity : item.quantity }
            });
          }
        }
      }

      existingInvoice.status = "cancelled";
      existingInvoice.cancelledAt = new Date().toISOString();
      existingInvoice.cancelledBy = gate.actor.name;
      existingInvoice.cancelReason = gate.reason;
      existingInvoice.lastModifiedReason = "cancel";

      const saved = await existingInvoice.save();

      // The audit row is best-effort: the cancel itself has already succeeded and
      // is recorded on the invoice, so a logging failure must not report it as an
      // error the user would then retry.
      try {
        await AuditLog.create({
          action: "invoice.cancel",
          entityType: "Invoice",
          entityRef: existingInvoice.invoiceNumber,
          entityId: String(existingInvoice._id),
          partyName: existingInvoice.customerName,
          amount: Number(existingInvoice.total) || 0,
          reason: gate.reason,
          performedBy: gate.actor.name,
          performedByUserId: gate.actor.id,
          performedByRole: gate.actor.role,
          pinVerified: true,
          usedLegacyPin: gate.usedLegacyPin,
          ip: gate.ip,
          userAgent: gate.userAgent,
          metadata: { paymentMode: existingInvoice.paymentMode, date: existingInvoice.date },
        });
      } catch (logErr) {
        console.warn("Notice: audit log for invoice cancel:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: "Invoice cancelled successfully",
        usedLegacyPin: gate.usedLegacyPin,
        data: saved,
      });
    }

    const updatedInvoice = await Invoice.findOneAndUpdate(
      { invoiceNumber: body.invoiceNumber },
      { ...body, lastModifiedReason: "content-edit" },
      { new: true }
    );

    return NextResponse.json({ success: true, message: "Invoice updated successfully", data: updatedInvoice });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const invoiceNumber = searchParams.get("invoiceNumber");

    if (!invoiceNumber) {
      return NextResponse.json({ success: false, error: "Invoice number is required" }, { status: 400 });
    }

    // A DELETE carries no body in some clients, so the PIN and reason may arrive
    // either way. Both are read before anything is changed.
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const pin = payload.pin ?? searchParams.get("pin") ?? "";
    const reason = payload.reason ?? searchParams.get("reason") ?? "";

    const gate = await authoriseDestructiveAction(req, "invoice.delete", pin, reason);
    if (!gate.ok) return gate.response;

    await connectToDatabase();

    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) {
      return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 });
    }

    const snapshot = invoice.toObject();

    // Archive BEFORE unwinding anything: if the archive write fails there is still
    // an invoice to look at, whereas a half-reversed bill with no record would be
    // unrecoverable.
    await DeletedInvoice.create({
      ...snapshot,
      _id: undefined,
      invoiceNumber: invoice.invoiceNumber,
      docType: invoice.type === "proforma" ? "Proforma" : invoice.type === "credit-note" ? "Credit Note" : invoice.type === "sales-order" ? "Sales Order" : "Invoice",
      customerName: invoice.customerName,
      total: Number(invoice.total) || 0,
      deletedAt: new Date(),
      deletedBy: gate.actor.name,
      deletedByRole: gate.actor.role,
      deletedByUserId: gate.actor.id,
      deleteReason: gate.reason,
      pinVerified: true,
      usedLegacyPin: gate.usedLegacyPin,
      snapshot,
    });

    // Reversal logic below is unchanged from before this route required a PIN.
    if (invoice.balanceAmount > 0) {
      await Customer.findByIdAndUpdate(invoice.customerId, {
        $inc: { outstandingBalance: invoice.type === "credit-note" ? invoice.balanceAmount : -invoice.balanceAmount }
      });
    }

    if (invoice.type !== "proforma") {
      if (invoice.items && invoice.items.length > 0) {
        for (const item of invoice.items) {
          if (item.itemId) {
            await Item.findByIdAndUpdate(item.itemId, {
              $inc: { currentStock: invoice.type === "credit-note" ? -item.quantity : item.quantity }
            });
          }
        }
      }
    }

    await Invoice.findOneAndDelete({ invoiceNumber });

    try {
      await AuditLog.create({
        action: "invoice.delete",
        entityType: "Invoice",
        entityRef: invoice.invoiceNumber,
        entityId: String(invoice._id),
        partyName: invoice.customerName,
        amount: Number(invoice.total) || 0,
        reason: gate.reason,
        performedBy: gate.actor.name,
        performedByUserId: gate.actor.id,
        performedByRole: gate.actor.role,
        pinVerified: true,
        usedLegacyPin: gate.usedLegacyPin,
        ip: gate.ip,
        userAgent: gate.userAgent,
        metadata: { paymentMode: invoice.paymentMode, date: invoice.date, type: invoice.type },
      });
    } catch (logErr) {
      console.warn("Notice: audit log for invoice delete:", logErr);
    }

    return NextResponse.json({
      success: true,
      message: "Invoice deleted and archived to the audit trail",
      usedLegacyPin: gate.usedLegacyPin,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
