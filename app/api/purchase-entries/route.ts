import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/db";
import PurchaseEntry from "@/models/PurchaseEntry";
import Supplier from "@/models/Supplier";
import Item from "@/models/Item";
import PurchaseOrder from "@/models/PurchaseOrder";
import StockRequest from "@/models/StockRequest";
import SerialNumber from "@/models/SerialNumber";
import DeletedPurchaseEntry from "@/models/DeletedPurchaseEntry";
import AuditLog from "@/models/AuditLog";
import StaffTask from "@/models/StaffTask";
import { authoriseDestructiveAction } from "@/lib/destructiveAction";

/**
 * A bill entered without a linked PO (a direct/walk-in purchase) had no
 * record on the Purchase Order side at all — so the two screens drifted:
 * a real purchase existed only in Entries, never in Orders. Mirroring it
 * here as an already-"received" PO keeps both lists complete regardless
 * of which screen someone started from.
 */
async function mirrorEntryAsPurchaseOrder(entry: any) {
  try {
    const count = await PurchaseOrder.countDocuments();
    const poNo = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}-E`;
    await PurchaseOrder.create({
      poNo,
      supplierName: entry.supplierName,
      date: entry.billDate,
      totalAmount: entry.total,
      subtotal: entry.subtotal,
      gst: entry.gst,
      status: "received",
      items: (entry.items || []).map((it: any) => ({
        itemId: it.itemId,
        name: it.name,
        quantity: it.quantity,
        rate: it.rate,
        gstRate: it.gstRate,
      })),
    });
  } catch (err) {
    console.warn("Notice: mirroring direct entry as purchase order:", err);
  }
}

/** Closes the "record an entry for this PO" reminder once that entry exists. */
async function completeEntryReminderTask(poNo: string) {
  try {
    await StaffTask.updateMany(
      { taskTitle: `Record Purchase Entry for PO ${poNo}`, status: { $ne: "Completed" } },
      { $set: { status: "Completed", completedAt: new Date(), completionRemarks: "Purchase Entry recorded." } }
    );
  } catch (err) {
    console.warn("Notice: completing purchase entry reminder task:", err);
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    await connectToDatabase();
    
    const query = type ? { type } : { type: { $ne: "debit-note" } }; // Default to entries if no type specified
    
    const entries = await PurchaseEntry.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data: entries });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await connectToDatabase();

    // Determine sequence number or validate uniqueness
    let newBillNo = body.billNo;
    if (!newBillNo) {
      const isDebitNote = body.type === "debit-note";
      const count = await PurchaseEntry.countDocuments({ type: isDebitNote ? "debit-note" : "entry" });
      const prefix = isDebitNote ? "DN-2026-" : "BILL-2026-";
      newBillNo = `${prefix}${String(count + 1).padStart(4, "0")}`;
    } else {
      const cleanBill = String(newBillNo).trim();
      const escapedBill = cleanBill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingEntry = await PurchaseEntry.findOne({
        billNo: { $regex: new RegExp(`^${escapedBill}$`, "i") },
        type: body.type === "debit-note" ? "debit-note" : { $ne: "debit-note" }
      });
      if (existingEntry) {
        return NextResponse.json({
          success: false,
          error: `Purchase Bill #${cleanBill} already exists in the system (Supplier: ${existingEntry.supplierName}). Every purchase entry must have a unique bill number.`
        }, { status: 400 });
      }
    }

    const payload = {
      ...body,
      billNo: newBillNo,
    };

    const entry = await PurchaseEntry.create(payload);

    // Update Supplier Balance and Auto-create if missing
    if (body.supplierName) {
      try {
        const supName = body.supplierName.trim();
        const supPhone = body.supplierPhone?.trim() || "";
        let existingSupplier = null;
        if (supPhone) {
          existingSupplier = await Supplier.findOne({ phone: supPhone });
        }
        if (!existingSupplier) {
          existingSupplier = await Supplier.findOne({ name: { $regex: new RegExp(`^${supName}$`, "i") } });
        }

        const balanceImpact = body.type === "debit-note" ? -(Number(body.balance) || 0) : (Number(body.balance) || 0);

        if (!existingSupplier) {
          const count = await Supplier.countDocuments();
          const suppCode = `SUPP-${String(count + 1).padStart(3, "0")}`;
          await Supplier.create({
            code: suppCode,
            name: supName,
            phone: supPhone || "0000000000",
            email: body.supplierEmail || "",
            gstNumber: body.supplierGstin || "",
            address: {
              line1: "Commercial Trade Hub / Store Outlet",
              city: "Mumbai",
              state: "Maharashtra",
              pincode: "400001",
              country: "India",
            },
            creditLimit: 100000,
            creditDays: 45,
            outstandingBalance: balanceImpact,
            status: "active",
          });
        } else if (balanceImpact !== 0) {
          await Supplier.findByIdAndUpdate(
            existingSupplier._id,
            { $inc: { outstandingBalance: balanceImpact } }
          );
        }
      } catch (supErr) {
        console.warn("Supplier reconciliation note:", supErr);
      }
    }

    // Update Inventory Stock and Auto-Create Item if missing
    if (body.items && Array.isArray(body.items)) {
      for (const item of body.items) {
        const qtyImpact = body.type === "debit-note" ? -(Number(item.quantity) || 0) : (Number(item.quantity) || 0);
        const rate = Number(item.rate) || 0;
        const gstRate = Number(item.gstRate) || 18;

        try {
          // Robust matching: 1. By MongoDB _id, 2. By Item Code, 3. By Item Name
          let existingItem = null;
          if (item.itemId && mongoose.isValidObjectId(item.itemId)) {
            existingItem = await Item.findById(item.itemId);
          }
          if (!existingItem && item.itemCode) {
            existingItem = await Item.findOne({ code: item.itemCode });
          }
          if (!existingItem && item.name) {
            existingItem = await Item.findOne({ name: { $regex: new RegExp(`^${item.name.trim()}$`, "i") } });
          }

          const targetWarehouse = body.warehouse || "Ashoka Enterprises (Kunraghat Showroom)";
          const isGodownTarget = targetWarehouse.toLowerCase().includes("godown") || targetWarehouse.toLowerCase().includes("warehouse") || targetWarehouse.toLowerCase().includes("gida") || targetWarehouse.toLowerCase().includes("logistics");

          if (existingItem) {
            // Update existing product stock & purchase rate based on Showroom vs Godown target
            const incPayload: any = {};
            if (isGodownTarget) {
              incPayload.godownStock = qtyImpact;
            } else {
              incPayload.showroomStock = qtyImpact;
              incPayload.currentStock = qtyImpact;
            }

            await Item.findByIdAndUpdate(existingItem._id, {
              $inc: incPayload,
              $set: { purchasePrice: rate > 0 ? rate : existingItem.purchasePrice }
            });
          } else if (item.name && qtyImpact > 0) {
            // Auto-create new Item in Master
            const count = await Item.countDocuments();
            const itemCode = `ITEM-${String(count + 1).padStart(4, "0")}`;
            const sellPrice = rate > 0 ? Math.round(rate * 1.25) : 1000;
            const mrpVal = rate > 0 ? Math.round(rate * 1.30) : 1200;

            await Item.create({
              code: itemCode,
              name: item.name.trim(),
              category: "Electronics",
              brand: "ValuePlus",
              unit: "PCS",
              hsnCode: "8471",
              gstRate: gstRate,
              purchasePrice: rate,
              sellingPrice: sellPrice,
              mrp: mrpVal,
              openingStock: 0,
              showroomStock: isGodownTarget ? 0 : qtyImpact,
              godownStock: isGodownTarget ? qtyImpact : 0,
              currentStock: isGodownTarget ? 0 : qtyImpact,
              warehouse: targetWarehouse,
              reorderLevel: 5,
              status: "active"
            });
          }

          // Auto-register and sync individual unit Serial Numbers (IMEI / Serial IDs)
          if (item.serialNumbers && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
            const itId = existingItem?._id ? existingItem._id.toString() : (item.itemId || "");
            const vp = existingItem?.vpCode || existingItem?.code || item.vpCode || item.itemCode || "VP-GEN";
            const itName = existingItem?.name || item.name || "";

            for (const sn of item.serialNumbers) {
              const cleanSn = String(sn || "").trim();
              if (cleanSn) {
                await SerialNumber.findOneAndUpdate(
                  { serialNumber: cleanSn },
                  {
                    $set: {
                      itemId: itId,
                      vpCode: vp,
                      itemName: itName,
                      status: body.type === "debit-note" ? "RETURNED" : "AVAILABLE",
                      purchaseEntryId: entry._id.toString(),
                      price: rate,
                      warehouse: targetWarehouse,
                    },
                    $push: {
                      history: {
                        action: body.type === "debit-note" ? `Debit Note Return #${newBillNo}` : `Inward Purchase Bill #${newBillNo}`,
                        date: new Date(),
                        performedBy: "Store Purchase Inward",
                        details: `Supplier: ${body.supplierName} | Rate: ₹${rate}`,
                      }
                    }
                  },
                  { upsert: true, new: true }
                );
              }
            }
          }

          // Auto-update any Stock Requests for this item from "Pending" / "Sent" to "Fulfilled"
          if (item.name) {
            await StockRequest.updateMany(
              {
                "items.itemName": { $regex: new RegExp(`^${item.name.trim()}$`, "i") },
                status: { $in: ["Pending", "Approved", "Sent"] }
              },
              { $set: { status: "Fulfilled" } }
            );
          }
        } catch (itemErr) {
          console.warn("Item stock / creation sync note:", itemErr);
        }
      }
    }

    // Update Linked Purchase Order Status, and close its "record an entry" reminder
    if (body.linkedPoNo) {
      await PurchaseOrder.findOneAndUpdate(
        { poNo: body.linkedPoNo },
        { status: "received" }
      );
      await completeEntryReminderTask(body.linkedPoNo);
    } else if (body.type !== "debit-note") {
      // Direct entry with no PO behind it — mirror it as an already-received
      // Purchase Order so it shows up on that screen too.
      await mirrorEntryAsPurchaseOrder(entry);
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error: any) {
    if (error.code === 11000) {
       return NextResponse.json({ success: false, error: "Bill number already exists" }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const billNo = searchParams.get("billNo");

    if (!billNo) {
      return NextResponse.json({ success: false, error: "billNo is required" }, { status: 400 });
    }

    const body = await req.json();
    await connectToDatabase();

    const entry = await PurchaseEntry.findOne({ billNo });
    if (!entry) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    // Soft-cancel: unlike DELETE, the bill record survives (for audit / payables tracking)
    if (body.action === "cancel") {
      const gate = await authoriseDestructiveAction(req, "purchase.entry.cancel", body.pin, body.reason);
      if (!gate.ok) return gate.response;

      if (entry.status === "cancelled") {
        return NextResponse.json({ success: false, error: "Bill is already cancelled" }, { status: 400 });
      }

      // Reverse the balance impact (same logic as hard delete)
      if (entry.supplierName && entry.balance !== 0) {
        const balanceImpact = entry.type === "debit-note" ? entry.balance : -entry.balance;
        await Supplier.findOneAndUpdate(
          { name: entry.supplierName },
          { $inc: { outstandingBalance: balanceImpact } }
        );
      }

      // Reverse Inventory Stock (same logic as hard delete)
      if (entry.items && Array.isArray(entry.items)) {
        for (const item of entry.items) {
          if (item.itemId) {
            const qtyImpact = entry.type === "debit-note" ? item.quantity : -item.quantity;
            if (qtyImpact !== 0) {
              await Item.findByIdAndUpdate(item.itemId, { $inc: { currentStock: qtyImpact } });
            }
          }
        }
      }

      entry.status = "cancelled";
      entry.cancelledAt = new Date().toISOString();
      entry.cancelledBy = gate.actor.name;
      entry.cancelReason = gate.reason;
      entry.lastModifiedReason = "cancel";
      const saved = await entry.save();

      try {
        await AuditLog.create({
          action: "purchase-entry.cancel",
          entityType: "PurchaseEntry",
          entityRef: entry.billNo,
          entityId: String(entry._id),
          partyName: entry.supplierName,
          amount: Number(entry.total) || 0,
          reason: gate.reason,
          performedBy: gate.actor.name,
          performedByUserId: gate.actor.id,
          performedByRole: gate.actor.role,
          pinVerified: true,
          usedLegacyPin: gate.usedLegacyPin,
          ip: gate.ip,
          userAgent: gate.userAgent,
        });
      } catch (logErr) {
        console.warn("Notice: audit log for purchase entry cancel:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: "Purchase bill cancelled successfully",
        usedLegacyPin: gate.usedLegacyPin,
        data: saved,
      });
    }

    // Generic edit — items/stock are untouched here, so this must stay limited
    // to non-stock fields (supplier contact info, due date, notes, payment)
    // until an edit UI that reconciles stock diffs exists.
    const updatedEntry = await PurchaseEntry.findOneAndUpdate(
      { billNo },
      { ...body, lastModifiedReason: "content-edit" },
      { new: true }
    );

    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const billNo = searchParams.get("billNo");

    if (!billNo) {
      return NextResponse.json({ success: false, error: "billNo is required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    await connectToDatabase();

    const entry = await PurchaseEntry.findOne({ billNo });
    if (!entry) {
      return NextResponse.json({ success: false, error: "Entry not found" }, { status: 404 });
    }

    const gate = await authoriseDestructiveAction(req, "purchase.entry.delete", body.pin, body.reason);
    if (!gate.ok) return gate.response;

    // Reverse the balance impact
    if (entry.supplierName && entry.balance !== 0) {
      const balanceImpact = entry.type === "debit-note" ? entry.balance : -entry.balance;
      await Supplier.findOneAndUpdate(
        { name: entry.supplierName },
        { $inc: { outstandingBalance: balanceImpact } }
      );
    }

    // Reverse Inventory Stock
    if (entry.items && Array.isArray(entry.items)) {
      for (const item of entry.items) {
        if (item.itemId) {
          const qtyImpact = entry.type === "debit-note" ? item.quantity : -item.quantity;
          if (qtyImpact !== 0) {
            await Item.findByIdAndUpdate(item.itemId, { $inc: { currentStock: qtyImpact } });
          }
        }
      }
    }

    // Archive the full record before it's gone — mirrors DeletedInvoice so a
    // hard delete still leaves something the audit trail can show.
    try {
      await DeletedPurchaseEntry.create({
        billNo: entry.billNo,
        supplierName: entry.supplierName,
        total: entry.total,
        deletedAt: new Date(),
        deletedBy: gate.actor.name,
        deletedByRole: gate.actor.role,
        deletedByUserId: gate.actor.id,
        deleteReason: gate.reason,
        pinVerified: true,
        usedLegacyPin: gate.usedLegacyPin,
        snapshot: entry.toObject(),
      });
    } catch (archiveErr) {
      console.warn("Notice: archive for purchase entry delete:", archiveErr);
    }

    try {
      await AuditLog.create({
        action: "purchase-entry.delete",
        entityType: "PurchaseEntry",
        entityRef: entry.billNo,
        entityId: String(entry._id),
        partyName: entry.supplierName,
        amount: Number(entry.total) || 0,
        reason: gate.reason,
        performedBy: gate.actor.name,
        performedByUserId: gate.actor.id,
        performedByRole: gate.actor.role,
        pinVerified: true,
        usedLegacyPin: gate.usedLegacyPin,
        ip: gate.ip,
        userAgent: gate.userAgent,
      });
    } catch (logErr) {
      console.warn("Notice: audit log for purchase entry delete:", logErr);
    }

    await PurchaseEntry.findOneAndDelete({ billNo });

    return NextResponse.json({
      success: true,
      message: "Purchase bill deleted and archived to the audit trail",
      usedLegacyPin: gate.usedLegacyPin,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
