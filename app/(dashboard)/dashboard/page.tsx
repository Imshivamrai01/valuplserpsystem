"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package,
  Users, AlertTriangle, ArrowRight, Eye, MoreHorizontal,
  IndianRupee, Receipt, Wallet, CreditCard, Activity,
  Star, Sparkles, Calendar, Clock, CheckCircle2, Search,
  X, Filter, ExternalLink, Printer, Send, ShieldAlert, Plus, FileText, Download, Trash2, Building, Building2, UserCheck, Tv, Smartphone, Laptop, Fan, HardDrive, Headphones, BarChart3, PieChart as PieChartIcon, ArrowUpRight, MessageCircle, Wifi, WifiOff, Zap, MapPin, Phone, CheckSquare, ListTodo, UserPlus, Target, Crown, MessageSquare, Check
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn, formatCurrency, formatNumber, indianNumberFormat, formatDateShort } from "@/lib/utils";
import ValueplusInvoice from "@/app/invoice/page";
import { InvoiceCreationModal } from "@/components/InvoiceCreationModal";
import { DateRangeFilter, resolveDateRange, isDateInRange } from "@/components/shared/date-range-filter";
import { Skeleton, MetricCardsShimmer, TableShimmer, ChartShimmer, DistributionShimmer } from "@/components/shared/shimmer-skeleton";
import {
  cacheDashboardStats,
  getCachedDashboardStats,
  cacheDashboardExtended,
  getCachedDashboardExtended,
} from "@/lib/offline-storage";
import { AttendancePunchWidget } from "@/components/shared/AttendancePunchWidget";
import { useBranch } from "@/context/BranchContext";
import { useSession } from "next-auth/react";
import { SalesmanDashboardView } from "@/components/dashboard/SalesmanDashboardView";
import { ProductLedgerModal } from "@/components/ProductLedgerModal";
import { ExportMenu } from "@/components/shared/ExportMenu";



// ─── DUMMY DATA FOR CHARTS ────────────────────────────────────
const BASE_PAYMENT_MODES = [
  { name: "Cash", value: 222789, color: "#76C043" },
  { name: "UPI/Online", value: 316111, color: "#3F63AD" },
  { name: "Finance", value: 176989, color: "#F59E0B" },
];

const BASE_DAILY_REVENUE = [
  { date: "25 Jul", revenue: 85000, expense: 52000, profit: 33000 },
  { date: "26 Jul", revenue: 92000, expense: 58000, profit: 34000 },
  { date: "27 Jul", revenue: 110000, expense: 65000, profit: 45000 },
  { date: "28 Jul", revenue: 78000, expense: 49000, profit: 29000 },
  { date: "29 Jul", revenue: 95000, expense: 61000, profit: 34000 },
  { date: "30 Jul", revenue: 105000, expense: 62000, profit: 43000 },
  { date: "31 Jul", revenue: 125000, expense: 71000, profit: 54000 },
  { date: "01 Aug", revenue: 234500, expense: 98200, profit: 136300 },
];

const INVENTORY_STATUS = [
  { name: "In Stock", value: 68, color: "#10B981" },
  { name: "Low Stock", value: 18, color: "#F59E0B" },
  { name: "Out of Stock", value: 14, color: "#EF4444" },
];

const TOP_PRODUCTS = [
  { name: "Dell XPS 15 9530 Laptop", sales: 24, revenue: 3599760, growth: 18.4 },
  { name: "Apple MacBook Pro 16\"", sales: 18, revenue: 4498200, growth: 14.2 },
  { name: "Samsung 27\" 4K Monitor", sales: 35, revenue: 1049965, growth: 22.1 },
  { name: "Logitech MX Master 3S Mouse", sales: 85, revenue: 764575, growth: 9.6 },
  { name: "HP LaserJet Pro MFP Printer", sales: 14, revenue: 553000, growth: 12.0 },
];

const TOP_CUSTOMERS = [
  { name: "Reliance Retail Ltd", city: "Mumbai", amount: 176989, invoices: 2, status: "active" },
  { name: "Tata Consultancy Services Ltd", city: "Delhi", amount: 316111, invoices: 3, status: "active" },
  { name: "Infosys Limited", city: "Bengaluru", amount: 189500, invoices: 2, status: "active" },
];

// ─── CUSTOM TOOLTIP ────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc, curr) => acc + (curr.value || 0), 0);
    return (
      <div className="bg-[#1B2537]/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-3.5 text-xs text-white min-w-[210px] space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <span className="font-bold text-slate-300">{label}</span>
          <span className="font-mono font-extrabold text-[#76C043]">{formatCurrency(total)}</span>
        </div>
        <div className="space-y-1.5">
          {payload.map((entry) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-300 capitalize">{entry.name}</span>
              </div>
              <span className="font-mono font-bold text-slate-100">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ─── STATUS BADGE ──────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: "success" | "warning" | "destructive" | "info" | "secondary"; label: string }> = {
    paid: { variant: "success", label: "Paid" },
    sent: { variant: "info", label: "Sent / Pending" },
    pending: { variant: "warning", label: "Pending" },
    overdue: { variant: "destructive", label: "Overdue" },
    partial: { variant: "info", label: "Partial" },
    active: { variant: "success", label: "Active" },
  };
  const config = map[status] ?? { variant: "secondary", label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

// ─── MAIN DASHBOARD PAGE ───────────────────────────────────────


export default function DashboardPage() {
  const router = useRouter();
  const { activeLocation } = useBranch();
  const { data: session, status } = useSession();

  const userRole = ((session?.user as any)?.role || "").toLowerCase();

  // Instant role-based navigation guards
  useEffect(() => {
    if (status === "loading") return;
    if (userRole === "driver") {
      router.replace("/driver/deliveries");
    } else if (userRole === "warehouse") {
      router.replace("/warehouse");
    } else if (userRole === "supplier") {
      router.replace("/purchase/orders");
    }
  }, [userRole, status, router]);

  // Period Filter State
  const [dateFilter, setDateFilter] = useState("Today");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);

  // Widget specific states
  const [widgetFilters, setWidgetFilters] = useState({
    trends: "Today",
    pie: "Today",
    kpi: "Today",
    expenses: "Today",
    products: "Today",
    customers: "Today",
    logs: "Today",
    recent: "Today",
    staff: "Today"
  });
  const [widgetData, setWidgetData] = useState<any>({});
  const [widgetLoading, setWidgetLoading] = useState({
    trends: false,
    pie: false,
    kpi: false,
    expenses: false,
    products: false,
    customers: false,
    logs: false,
    recent: false,
    staff: false
  });

  // Drilldown Modal State
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expenseViewTab, setExpenseViewTab] = useState<"purpose" | "mode">("purpose");
  const [expenseModalModeFilter, setExpenseModalModeFilter] = useState<string>("all");
  const [leakageModal, setLeakageModal] = useState<{
    type: string;
    title: string;
    description: string;
    invoices: any[];
    color: string;
  } | null>(null);

  // Form Modals State
  const [openInvoiceModal, setOpenInvoiceModal] = useState(false);
  const [openEstimateModal, setOpenEstimateModal] = useState(false);
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [openItemModal, setOpenItemModal] = useState(false);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);

  // Official Invoice Print Preview State
  const [activePrintInvoice, setActivePrintInvoice] = useState<any | null>(null);

  // Submitting State
  const [submitting, setSubmitting] = useState(false);

  // Value Plus Category Stock & Warranty Metrics
  const [openStockModal, setOpenStockModal] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockBreakdown, setStockBreakdown] = useState<{
    totalQuantity: number;
    totalStockValue: number;
    totalItemsCount?: number;
    warehouseFilterApplied?: boolean;
    warehouseRequested?: string;
    electronics: { quantity: number; value: number; count?: number; categories?: Array<{ name: string; quantity: number; value: number; itemCount: number }> };
    mobile: { quantity: number; value: number; count?: number; categories?: Array<{ name: string; quantity: number; value: number; itemCount: number }> };
    categories?: Array<{ name: string; group?: string; quantity: number; value: number; itemCount: number }>;
  }>({
    totalQuantity: 0,
    totalStockValue: 0,
    totalItemsCount: 0,
    electronics: { quantity: 0, value: 0, count: 0 },
    mobile: { quantity: 0, value: 0, count: 0 },
    categories: [],
  });
  // Live product rows behind the category totals (the stock API returns these alongside `data`)
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [stockCategoryFilter, setStockCategoryFilter] = useState<string>("all");
  // "Electronics" is an umbrella group (fridge, cooler, AC, TV, appliances…), not a single category
  const [stockGroupFilter, setStockGroupFilter] = useState<"all" | "electronics" | "mobile">("all");
  // Product whose full stock/sales ledger is open
  const [ledgerProduct, setLedgerProduct] = useState<{ id?: string; code?: string; vpCode?: string; name?: string } | null>(null);

  // Open a product's ledger (purchases, sales, serials) from any stock list
  const openProductLedger = (it: any) => {
    setLedgerProduct({ id: it._id, code: it.code, vpCode: it.vpCode, name: it.name });
  };
  // Open the same product in Item Master
  const openProductMaster = (it: any) => {
    router.push(`/masters/items?search=${encodeURIComponent(it.vpCode || it.code || it.name || "")}`);
  };
  const [isAuditPending, setIsAuditPending] = useState(false);
  const [warrantyData, setWarrantyData] = useState<{ totalSales: number; totalCount: number; conversionRate: number }>({
    totalSales: 0,
    totalCount: 0,
    conversionRate: 0,
  });
  const [staffPeriod, setStaffPeriod] = useState<"today" | "week" | "month">("today");
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);

  // Simple Forms
  const [estimateForm, setEstimateForm] = useState({ customerName: "", total: "", notes: "" });
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", gstNumber: "", city: "Gorakhpur", creditLimit: "50000" });
  const [itemForm, setItemForm] = useState({ name: "", hsnCode: "8528", gstRate: "18", purchasePrice: "", sellingPrice: "", openingStock: "10" });
  const [paymentForm, setPaymentForm] = useState({ partyName: "", amount: "", paymentMode: "Cash Counter", notes: "" });

  // ─── ADMIN & STAFF TASKS STATE ───────────────────────────
  const [tasks, setTasks] = useState<any[]>([
    {
      _id: "task-1",
      taskTitle: "Verify Bajaj Finance DO & Bank Settlement",
      assignedStaff: "Admin (Self)",
      priority: "Urgent",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "17:00",
      description: "Reconcile delivery orders and payout statement for Gorakhpur branch",
      status: "In Progress",
      createdBy: "Admin",
    },
    {
      _id: "task-2",
      taskTitle: "Call Walk-in Customer for Sony Bravia 55' OLED",
      assignedStaff: "Amit Singh",
      priority: "High",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "14:30",
      description: "Customer requested 5% card cashback offer and zero-downpayment scheme",
      status: "Pending",
      createdBy: "Admin",
    },
    {
      _id: "task-3",
      taskTitle: "Dispatch Inter-Warehouse Stock to Deoria Road Godown",
      assignedStaff: "Rahul Verma",
      priority: "Medium",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "16:00",
      description: "Transfer 10 units Voltas 1.5T Inverter AC & create Delivery Challan",
      status: "Completed",
      createdBy: "Admin",
    },
    {
      _id: "task-4",
      taskTitle: "Customer Follow-up for Extended Warranty Protection",
      assignedStaff: "Priya Sharma",
      priority: "Medium",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "18:00",
      description: "Contact 5 high-value appliance customers for 2nd year extended warranty",
      status: "Pending",
      createdBy: "Admin",
    },
  ]);
  const [taskTabFilter, setTaskTabFilter] = useState<"all" | "admin" | "staff" | "pending" | "completed">("all");
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    taskTitle: "",
    assignedStaff: "Admin (Self)",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    dueDate: new Date().toISOString().split("T")[0],
    dueTime: "18:00",
    description: "",
    createdBy: "Admin",
  });
  const [topSellingCategoryTab, setTopSellingCategoryTab] = useState<"all" | "mobiles" | "electronics">("all");

  // ─── LEADS & CONVERSION PIPELINE STATE ───────────────────────────
  const [leads, setLeads] = useState<any[]>([
    {
      _id: "lead-1",
      leadId: "LEAD-2026-0041",
      customerName: "Ramesh Srivastava",
      mobile: "9839123456",
      interestedProduct: "Samsung 65' Neo QLED 4K Smart TV",
      estimatedValue: 124990,
      assignedStaff: "Amit Singh",
      priority: "High",
      status: "Follow-up",
      followUpDate: new Date().toISOString().split("T")[0],
      notes: "Interested in 0% Bajaj Finance EMI scheme and free wall-mount installation",
    },
    {
      _id: "lead-2",
      leadId: "LEAD-2026-0042",
      customerName: "Pooja Mishra",
      mobile: "9450234567",
      interestedProduct: "LG 8kg AI Front Load Washing Machine",
      estimatedValue: 42990,
      assignedStaff: "Priya Sharma",
      priority: "Urgent",
      status: "Converted",
      followUpDate: new Date().toISOString().split("T")[0],
      notes: "Billed successfully via INV-2026-0042 (Paid via POS Card)",
    },
    {
      _id: "lead-3",
      leadId: "LEAD-2026-0043",
      customerName: "Dr. Alok Verma",
      mobile: "9125345678",
      interestedProduct: "Voltas 1.5 Ton 3-Star Inverter Split AC",
      estimatedValue: 36490,
      assignedStaff: "Rahul Verma",
      priority: "Medium",
      status: "Follow-up",
      followUpDate: new Date().toISOString().split("T")[0],
      notes: "Needs site inspection for piping before billing on Monday",
    },
    {
      _id: "lead-4",
      leadId: "LEAD-2026-0044",
      customerName: "Sunil Tiwari",
      mobile: "9794456789",
      interestedProduct: "iPhone 16 Pro 256GB Desert Titanium",
      estimatedValue: 129900,
      assignedStaff: "Amit Singh",
      priority: "High",
      status: "New",
      followUpDate: new Date().toISOString().split("T")[0],
      notes: "Walk-in inquiry asking for HDFC bank instant discount",
    },
  ]);
  const [leadTabFilter, setLeadTabFilter] = useState<"all" | "new" | "followup" | "converted">("all");
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [leadForm, setLeadForm] = useState({
    customerName: "",
    mobile: "",
    interestedProduct: "",
    estimatedValue: "",
    assignedStaff: "Amit Singh",
    priority: "Medium" as "Low" | "Medium" | "High" | "Urgent",
    status: "New" as "New" | "Contacted" | "Interested" | "Follow-up" | "Converted" | "Lost",
    followUpDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // ─── DUE / CREDIT COLLECTIONS & SETTLEMENT STATE ───────────
  const [dueInvoices, setDueInvoices] = useState<any[]>([]);
  const [dueTabFilter, setDueTabFilter] = useState<"today" | "overdue" | "upcoming" | "cleared" | "all">("today");
  // Date-wise filter for the due collections widget (empty = all dates)
  const [dueDateFilter, setDueDateFilter] = useState<string>("");
  const [dueDateRange, setDueDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [selectedDueInvoice, setSelectedDueInvoice] = useState<any | null>(null);
  const [clearDuePaymentMode, setClearDuePaymentMode] = useState<string>("Cash");
  const [clearDueTxnId, setClearDueTxnId] = useState<string>("");
  const [clearDueStaff, setClearDueStaff] = useState<string>("AMIT SINGH");
  const [clearDueNotes, setClearDueNotes] = useState<string>("");
  const [isClearingDue, setIsClearingDue] = useState<boolean>(false);

  const fetchDueInvoices = async () => {
    try {
      const res = await fetch("/api/invoices");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setDueInvoices(json.data);
      }
    } catch (e) {
      console.warn("Notice loading invoices for due tracking:", e);
    }
  };

  const handleConfirmClearDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDueInvoice) return;
    setIsClearingDue(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: selectedDueInvoice.invoiceNumber,
          action: "clear-due",
          clearedAmount: selectedDueInvoice.balanceAmount || selectedDueInvoice.total,
          dueClearedMode: clearDuePaymentMode,
          dueClearedBy: clearDueStaff,
          dueClearedTxnId: clearDueTxnId || `TXN-${Date.now()}`,
          dueClearedNotes: clearDueNotes || `Due cleared via ${clearDuePaymentMode}`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`✅ Due of ₹${Number(selectedDueInvoice.balanceAmount).toLocaleString("en-IN")} cleared successfully for ${selectedDueInvoice.customerName}!`);
        setSelectedDueInvoice(null);
        setClearDueTxnId("");
        setClearDueNotes("");
        fetchDueInvoices();
        loadAllDashboardData();
      } else {
        toast.error(json.error || "Failed to clear due");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error while clearing due");
    } finally {
      setIsClearingDue(false);
    }
  };

  const fetchTasksAndLeads = async () => {
    try {
      const [tasksRes, leadsRes, invoicesRes] = await Promise.allSettled([
        fetch("/api/staff/tasks"),
        fetch("/api/crm/leads"),
        fetch("/api/invoices")
      ]);
      if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
        const json = await tasksRes.value.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setTasks(json.data);
        }
      }
      if (leadsRes.status === "fulfilled" && leadsRes.value.ok) {
        const json = await leadsRes.value.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setLeads(json.data);
        }
      }
      if (invoicesRes.status === "fulfilled" && invoicesRes.value.ok) {
        const json = await invoicesRes.value.json();
        if (json.success && Array.isArray(json.data)) {
          setDueInvoices(json.data);
        }
      }
    } catch (e) {
      console.warn("Notice loading tasks/leads/invoices:", e);
    }
  };

  const handleToggleTaskStatus = async (task: any) => {
    const nextStatus = task.status === "Completed" ? "Pending" : "Completed";
    setTasks(prev => prev.map(t => (t._id === task._id ? { ...t, status: nextStatus } : t)));
    try {
      if (task._id && !task._id.startsWith("task-")) {
        await fetch("/api/staff/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task._id, status: nextStatus }),
        });
      }
    } catch (err) {
      console.error("Task update error:", err);
    }
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.taskTitle.trim()) return;
    const newTask = {
      ...taskForm,
      _id: `task-${Date.now()}`,
      status: "Pending",
    };
    setTasks(prev => [newTask, ...prev]);
    setIsNewTaskModalOpen(false);
    try {
      const res = await fetch("/api/staff/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskForm),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setTasks(prev => prev.map(t => (t._id === newTask._id ? json.data : t)));
      }
    } catch (err) {
      console.error("Error creating task:", err);
    }
    setTaskForm({
      taskTitle: "",
      assignedStaff: "Admin (Self)",
      priority: "Medium",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "18:00",
      description: "",
      createdBy: "Admin",
    });
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t._id !== taskId));
    try {
      if (!taskId.startsWith("task-")) {
        await fetch(`/api/staff/tasks?id=${taskId}`, { method: "DELETE" });
      }
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setLeads(prev => prev.map(l => (l._id === leadId ? { ...l, status: newStatus } : l)));
    try {
      if (!leadId.startsWith("lead-")) {
        await fetch("/api/crm/leads", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: leadId, status: newStatus, actionNote: `Status updated to ${newStatus}` }),
        });
      }
    } catch (err) {
      console.error("Error updating lead status:", err);
    }
  };

  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.customerName.trim() || !leadForm.mobile.trim()) return;
    const newLead = {
      ...leadForm,
      _id: `lead-${Date.now()}`,
      leadId: `LEAD-2026-${String(leads.length + 1).padStart(4, "0")}`,
      estimatedValue: Number(leadForm.estimatedValue || 0),
    };
    setLeads(prev => [newLead, ...prev]);
    setIsNewLeadModalOpen(false);
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...leadForm,
          estimatedValue: Number(leadForm.estimatedValue || 0),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setLeads(prev => prev.map(l => (l._id === newLead._id ? json.data : l)));
      }
    } catch (err) {
      console.error("Error creating lead:", err);
    }
    setLeadForm({
      customerName: "",
      mobile: "",
      interestedProduct: "",
      estimatedValue: "",
      assignedStaff: "Amit Singh",
      priority: "Medium",
      status: "New",
      followUpDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
  };

  const handleLeadWhatsApp = (lead: any) => {
    const cleanPhone = (lead.mobile || "").replace(/\D/g, "");
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Hello ${lead.customerName},\nThis is from *Value Plus / Ashoka Enterprises, Gorakhpur* regarding your enquiry for *${lead.interestedProduct}*.\nWe have exclusive 0% EMI schemes & festive showroom offers available today! How can we assist you?`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  };

  // ─── INSTANT CACHE HYDRATION (0ms offline-first render) ────────
  const hydrateFromCache = (s: string, e: string) => {
    const cachedStats = getCachedDashboardStats(`${s}_${e}`);
    if (cachedStats) {
      setData(cachedStats);
      setWidgetData({
        trends: cachedStats,
        pie: cachedStats,
        kpi: cachedStats,
        expenses: cachedStats,
        products: cachedStats,
        customers: cachedStats,
        logs: cachedStats,
        recent: cachedStats,
        staff: cachedStats,
      });
      setIsUsingCachedData(true);
    }

    const cachedExt = getCachedDashboardExtended();
    if (cachedExt) {
      if (cachedExt.stock) setStockBreakdown(cachedExt.stock);
      if (Array.isArray(cachedExt.stockItems)) setStockItems(cachedExt.stockItems);
      if (typeof cachedExt.auditPending === "boolean") setIsAuditPending(cachedExt.auditPending);
      if (cachedExt.warranty) setWarrantyData(cachedExt.warranty);
      if (cachedExt.staffPerformance) setStaffPerformance(cachedExt.staffPerformance);
    }
  };

  // ─── CONCURRENT ALL-IN-ONE DATA LOADER ───────────────────────────
  const loadAllDashboardData = async (startOverride?: string, endOverride?: string, customRange?: string) => {
    const s = startOverride || startDate;
    const e = endOverride || endDate;
    const range = customRange || dateFilter || "Today";
    const cacheKey = `${s}_${e}`;

    // Instant render from cache first if available
    hydrateFromCache(s, e);

    // Set loading indicator
    setLoading(true);

    try {
      const whParam = activeLocation?.name ? `&warehouse=${encodeURIComponent(activeLocation.name)}` : "";
      // Execute all dashboard data requirements in parallel
      const [statsRes, stockRes, auditRes, warrantyRes, staffRes] = await Promise.allSettled([
        fetch(`/api/dashboard/stats?startDate=${s}&endDate=${e}${whParam}`),
        fetch(`/api/reports/stock?${whParam.replace("&", "")}`),
        fetch("/api/inventory/audit?checkPending=true"),
        fetch("/api/warranty"),
        fetch(`/api/reports/performance?startDate=${s}&endDate=${e}&range=${encodeURIComponent(range)}`),
      ]);

      // 1. Process Dashboard Main Stats
      if (statsRes.status === "fulfilled" && statsRes.value.ok) {
        const statsJson = await statsRes.value.json();
        if (statsJson.success) {
          setData(statsJson);
          setWidgetData({
            trends: statsJson,
            pie: statsJson,
            kpi: statsJson,
            expenses: statsJson,
            products: statsJson,
            customers: statsJson,
            logs: statsJson,
            recent: statsJson,
            staff: statsJson,
          });
          cacheDashboardStats(cacheKey, statsJson);
          setIsUsingCachedData(false);

          if (statsJson.metrics?.warrantyRevenue > 0 || statsJson.metrics?.warrantyCount > 0) {
            setWarrantyData(prev => ({
              ...prev,
              totalSales: Math.max(prev.totalSales, statsJson.metrics.warrantyRevenue || 0),
              totalCount: Math.max(prev.totalCount, statsJson.metrics.warrantyCount || 0),
              conversionRate: Math.round(((statsJson.metrics.warrantyCount || 1) / Math.max(1, statsJson.metrics.totalOrders || 1)) * 100),
            }));
          }
        }
      }

      const extCacheUpdate: any = {};

      // 2. Process Stock Breakdown
      if (stockRes.status === "fulfilled" && stockRes.value.ok) {
        const stockJson = await stockRes.value.json();
        if (stockJson.success && stockJson.data) {
          setStockBreakdown(stockJson.data);
          extCacheUpdate.stock = stockJson.data;
        }
        if (stockJson.success && Array.isArray(stockJson.items)) {
          setStockItems(stockJson.items);
          extCacheUpdate.stockItems = stockJson.items;
        }
      }

      // 3. Process Audit Status
      if (auditRes.status === "fulfilled" && auditRes.value.ok) {
        const auditJson = await auditRes.value.json();
        if (auditJson.success) {
          setIsAuditPending(!!auditJson.pending);
          extCacheUpdate.auditPending = !!auditJson.pending;
        }
      }

      // 4. Process Warranty Metrics
      if (warrantyRes.status === "fulfilled" && warrantyRes.value.ok) {
        const warJson = await warrantyRes.value.json();
        if (warJson.success) {
          let warObj = warrantyData;
          if (warJson.metrics) {
            warObj = warJson.metrics;
          } else if (warJson.analytics) {
            warObj = {
              totalSales: warJson.analytics.totalRevenue || 0,
              totalCount: warJson.analytics.totalCount || 0,
              conversionRate: Math.round(((warJson.analytics.totalCount || 0) / Math.max(1, data?.metrics?.totalOrders || 1)) * 100),
            };
          }
          setWarrantyData(warObj);
          extCacheUpdate.warranty = warObj;
        }
      }

      // 5. Process Staff Performance
      if (staffRes.status === "fulfilled" && staffRes.value.ok) {
        const staffJson = await staffRes.value.json();
        if (staffJson.success) {
          setStaffPerformance(staffJson.data || []);
          extCacheUpdate.staffPerformance = staffJson.data || [];
        }
      }

      // Cache extended metrics for offline usage
      if (Object.keys(extCacheUpdate).length > 0) {
        cacheDashboardExtended(extCacheUpdate);
      }
    } catch (err) {
      console.warn("Dashboard concurrent load notice (using offline cached state):", err);
      setIsUsingCachedData(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffPerformance = async (period: string) => {
    try {
      const res = await fetch(`/api/reports/performance?period=${period}`);
      const json = await res.json();
      if (json.success) {
        setStaffPerformance(json.data || []);
        cacheDashboardExtended({ staffPerformance: json.data || [] });
      }
    } catch (e) {
      console.error("Staff perf fetch error:", e);
    }
  };

  const fetchWidgetData = async (widgetName: string, filterValue: string, customStart?: string, customEnd?: string) => {
    setWidgetLoading(prev => ({ ...prev, [widgetName]: true }));
    try {
      const { start, end } = resolveDateRange(filterValue, customStart, customEnd);
      
      if (widgetName === "staff") {
        const res = await fetch(`/api/reports/performance?startDate=${start}&endDate=${end}&range=${encodeURIComponent(filterValue)}`);
        const json = await res.json();
        if (json.success) {
          setStaffPerformance(json.data || []);
          cacheDashboardExtended({ staffPerformance: json.data || [] });
        }
        return;
      }

      const cacheKey = `${start}_${end}`;
      const localCached = getCachedDashboardStats(cacheKey);
      if (localCached) {
        setWidgetData((prev: any) => ({ ...prev, [widgetName]: localCached }));
      }

      const res = await fetch(`/api/dashboard/stats?startDate=${start}&endDate=${end}`);
      const json = await res.json();
      if (json.success) {
        setWidgetData((prev: any) => ({ ...prev, [widgetName]: json }));
        cacheDashboardStats(cacheKey, json);
      }
    } catch (err) {
      console.error(`Error fetching widget ${widgetName}:`, err);
    } finally {
      setWidgetLoading(prev => ({ ...prev, [widgetName]: false }));
    }
  };

  const refreshAllDashboard = () => {
    loadAllDashboardData();
    // Previously left out — this only reloaded the aggregate stats, so a bill
    // created (or its due cleared) elsewhere never updated the Due Collections
    // & Khata Settlement widget's own invoice list until the page was reloaded.
    fetchDueInvoices();
  };

  // Mount effect with offline listeners and instant caching
  useEffect(() => {
    setIsOffline(typeof navigator !== "undefined" && !navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      loadAllDashboardData();
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    const handleSync = () => {
      refreshAllDashboard();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("erp-invoice-created", handleSync);
      window.addEventListener("erp-purchase-created", handleSync);
      window.addEventListener("erp-payment-created", handleSync);
      window.addEventListener("erp-customer-updated", handleSync);
    }

    loadAllDashboardData();
    fetchTasksAndLeads();

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("erp-invoice-created", handleSync);
        window.removeEventListener("erp-purchase-created", handleSync);
        window.removeEventListener("erp-payment-created", handleSync);
        window.removeEventListener("erp-customer-updated", handleSync);
      }
    };
  }, [activeLocation?.name]);

  const handleWidgetFilterChange = (widgetName: string, val: string, customStart?: string, customEnd?: string) => {
    setWidgetFilters(prev => ({ ...prev, [widgetName]: val }));
    fetchWidgetData(widgetName, val, customStart, customEnd);
  };

  const handleUniversalFilterChange = (val: string, customStart?: string, customEnd?: string) => {
    setDateFilter(val);
    const { start: s, end: e } = resolveDateRange(val, customStart, customEnd);
    setStartDate(s);
    setEndDate(e);
    const newFilters = {
      trends: val,
      pie: val,
      kpi: val,
      expenses: val,
      products: val,
      customers: val,
      logs: val,
      recent: val,
      staff: val
    };
    setWidgetFilters(newFilters);
    loadAllDashboardData(s, e, val);
  };

  // Open Invoice Modal
  const handleOpenInvoiceModal = () => {
    setOpenInvoiceModal(true);
  };

  const handleCreateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estimateForm.customerName || !estimateForm.total) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "invoice", customerName: estimateForm.customerName, total: estimateForm.total, status: "draft", notes: "Estimate / Quotation" }),
      });
      const json = await res.json();
      if (json.success) {
        setOpenEstimateModal(false);
        setEstimateForm({ customerName: "", total: "", notes: "" });
        refreshAllDashboard();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "customer", ...customerForm }),
      });
      const json = await res.json();
      if (json.success) {
        setOpenCustomerModal(false);
        setCustomerForm({ name: "", phone: "", email: "", gstNumber: "", city: "Mumbai", creditLimit: "50000" });
        refreshAllDashboard();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.sellingPrice) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "item", ...itemForm }),
      });
      const json = await res.json();
      if (json.success) {
        setOpenItemModal(false);
        setItemForm({ name: "", hsnCode: "8471", gstRate: "18", purchasePrice: "", sellingPrice: "", openingStock: "10" });
        refreshAllDashboard();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.partyName || !paymentForm.amount) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "payment", ...paymentForm }),
      });
      const json = await res.json();
      if (json.success) {
        setOpenPaymentModal(false);
        setPaymentForm({ partyName: "", amount: "", paymentMode: "Cash Counter", notes: "" });
        refreshAllDashboard();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Derived metrics based on real API data
  const metrics = data?.metrics || {
    totalRevenue: 0,
    cashRevenue: 0,
    upiRevenue: 0,
    onlineRevenue: 0,
    cardRevenue: 0,
    financeRevenue: 0,
    warrantyRevenue: 0,
    warrantyCount: 0,
    dueRevenue: 0,
    dueCount: 0,
    duesCollected: 0,
    duesCollectedCount: 0,
    totalOrders: 0,
    pendingOrders: 0,
    lowStockItems: 0,
    totalItems: 0,
  };

  const leakage = data?.leakage || {
    cancelled: { count: 0, amount: 0, invoices: [] },
    deleted: { count: 0, amount: 0, invoices: [] },
    modified: { count: 0, amount: 0, invoices: [] },
    shifted: { count: 0, amount: 0, invoices: [] },
    billsModified: { count: 0, amount: 0, invoices: [] },
    reprinted: { count: 0, totalPrints: 0, amount: 0, invoices: [] },
    waivedOff: { count: 0, amount: 0, invoices: [] },
  };

  // Cancelled and deleted bills carry a reason and an authoriser. The other
  // leakage buckets are derived signals (a discount, a reprint) with nobody to
  // attribute them to, so those two columns would be blank for every row.
  const showsAudit = leakageModal?.type === "cancelled" || leakageModal?.type === "deleted";

  const vendorSupplier = data?.vendorSupplier || {
    vendorCollections: { total: 0, count: 0, byMode: {}, recent: [] },
    vendorDue: { total: 0, count: 0, overdue: 0, parties: [] },
    supplierOutstanding: { total: 0, count: 0, overdue: 0, parties: [] },
  };

  const transactions = data?.transactions || { cash: [], upi: [], online: [], card: [], finance: [], due: [] };
  const recentInvoices = data?.recentInvoices || [];

  const currentPieData = widgetData.pie || data;
  const currentPieMetrics = currentPieData?.metrics || metrics;
  const currentPieTxns = currentPieData?.transactions || transactions;

  // Total Sales = every mode the bill was settled or booked under. Credit sales
  // count (the sale happened when billed), but only once — via `dueSalesRevenue`.
  // Using `dueRevenue` here double-counted finance balances, which sit in
  // financeRevenue already.
  const totalCollectedAmount = (currentPieMetrics.cashRevenue || 0) + (currentPieMetrics.upiRevenue || 0) + (currentPieMetrics.onlineRevenue || 0) + (currentPieMetrics.cardRevenue || 0) + (currentPieMetrics.financeRevenue || 0) + (currentPieMetrics.dueSalesRevenue || 0);
  // "3 orders" for a single financed sale: one invoice legitimately lands in more
  // than one bucket — the down payment collected at billing in `upi`/`cash`/etc,
  // the loan balance in `finance`, and (until it's fully paid) the same invoice
  // again in `due` purely for outstanding-balance tracking. Summing array lengths
  // counted that one invoice three times. What "orders" actually means is
  // distinct invoices, so this dedupes by invoice number across every bucket —
  // `due` included, since a due-only credit sale must still count once.
  const totalBilledCount = (() => {
    const ids = new Set<string>();
    (["cash", "upi", "online", "card", "finance", "due"] as const).forEach((bucket) => {
      (currentPieTxns[bucket] || []).forEach((t: any) => {
        if (t?.id) ids.add(String(t.id));
      });
    });
    return ids.size || currentPieMetrics.totalOrders || 0;
  })();

  const PAYMENT_MODES = [
    { name: "Cash Counter", value: currentPieMetrics.cashRevenue || 0, count: currentPieTxns.cash?.length || 0, color: "#76C043", key: "cash", icon: Wallet },
    { name: "UPI / QR Code", value: currentPieMetrics.upiRevenue || 0, count: currentPieTxns.upi?.length || 0, color: "#8B5CF6", key: "upi", icon: Zap },
    { name: "NEFT / IMPS", value: currentPieMetrics.onlineRevenue || 0, count: currentPieTxns.online?.length || 0, color: "#3F63AD", key: "online", icon: Activity },
    { name: "Card (POS)", value: currentPieMetrics.cardRevenue || 0, count: currentPieTxns.card?.length || 0, color: "#06B6D4", key: "card", icon: CreditCard },
    { name: "Finance (Bajaj/HDB)", value: currentPieMetrics.financeRevenue || 0, count: currentPieTxns.finance?.length || 0, color: "#F59E0B", key: "finance", icon: Building2 },
    // Credit extended on bills raised in this period — customer khata only.
    // This used to read `dueRevenue`, which is the unpaid balance of EVERY invoice,
    // so a financed sale's loan portion appeared here as well as under Finance, and
    // the identical number was then printed again by the "Pending Due" row below.
    { name: "Due / Credit Bill", value: currentPieMetrics.dueSalesRevenue || 0, count: currentPieMetrics.dueSalesCount || 0, color: "#EF4444", key: "due", icon: Clock },
  ];

  // ─── KHATA (DUE) STATUS ───────────────────────────────────────────────────
  // Shown under the distribution bar, never inside it: a settled due is already
  // counted in the mode it was collected through.
  const dueClearedRevenue = currentPieMetrics.dueClearedRevenue || 0;
  // Running khata book across every period, taken from the full invoice list the
  // Due Collections widget already loads. Finance sales are excluded — the money
  // is owed by the financier, not the customer, and it sits under Finance.
  const allTimeDueCredit = dueInvoices.filter((inv: any) => {
    const bal = Number(inv.balanceAmount) || 0;
    if (bal <= 0) return false;
    const mode = String(inv.paymentMode || "").toLowerCase();
    const isFinance = Boolean(inv.financeProvider) || /finance|bajaj|hdb|emi|loan/.test(mode);
    return !isFinance;
  });
  const allTimeDueOutstanding = allTimeDueCredit.reduce((s: number, inv: any) => s + (Number(inv.balanceAmount) || 0), 0);
  const allTimeDueCount = allTimeDueCredit.length;
  // "Cash ₹5,000 · UPI ₹2,000" — which modes today's khata came in through.
  const dueClearedModeSummary = Object.entries(currentPieMetrics.dueClearedByMode || {})
    .filter(([, amt]) => (Number(amt) || 0) > 0)
    .sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0))
    .map(([bucket, amt]) => {
      const label = bucket === "cash" ? "Cash" : bucket === "upi" ? "UPI" : bucket === "card" ? "Card" : bucket === "online" ? "NEFT/IMPS" : bucket;
      return `${label} ₹${formatNumber(Math.round(Number(amt) || 0))}`;
    })
    .join(" · ");

  // Highest contributing channel for the selected period (footnote in the distribution card)
  const topPaymentMode = PAYMENT_MODES.reduce(
    (best, m) => (m.value > (best?.value || 0) ? m : best),
    PAYMENT_MODES[0]
  );

  // Human readable label for the distribution card period ("02 Sep", "Last 7 Days", ...)
  const pieRangeLabel = (() => {
    const f = widgetFilters.pie || "Today";
    const asDay = (d: Date) =>
      `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })}`;
    if (f === "Today") return asDay(new Date());
    if (f === "Yesterday") {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return asDay(y);
    }
    return f;
  })();

  // Key Business Performance card runs on its own date filter
  const kpiMetrics = widgetData.kpi?.metrics || metrics;

  // Sub-categories rolled up inside each stock group, ordered by stock value
  const electronicsSubCategories = (stockBreakdown.electronics.categories || []).map((c) => c.name);
  const mobileSubCategories = (stockBreakdown.mobile.categories || []).map((c) => c.name);

  const currentTrendsData = widgetData.trends || data;
  const DAILY_REVENUE = currentTrendsData?.dailyRevenue || data?.dailyRevenue || [];

  const getFilteredTransactions = () => {
    if (!activeModal) return [];
    let list: any[] = [];
    if (activeModal === "cash") list = transactions.cash || [];
    if (activeModal === "upi") list = transactions.upi || [];
    if (activeModal === "online") list = transactions.online || [];
    if (activeModal === "card") list = transactions.card || [];
    if (activeModal === "finance") list = transactions.finance || [];
    if (activeModal === "due") list = transactions.due || [];
    if (activeModal === "orders") list = recentInvoices || [];
    if (activeModal === "expenses" || activeModal?.startsWith("expense")) {
      const allExp = widgetData.expenses?.expenses?.all || widgetData.expenses?.expenses?.recent || data?.expenses?.all || data?.expenses?.recent || [];
      if (expenseModalModeFilter && expenseModalModeFilter !== "all") {
        list = allExp.filter((e: any) => {
          const m = (e.paymentMode || "").toLowerCase();
          const target = expenseModalModeFilter.toLowerCase();
          if (target === "cash") return m.includes("cash");
          if (target === "upi") return m.includes("upi");
          if (target.includes("bank")) return m.includes("bank") || m.includes("neft") || m.includes("rtgs") || m.includes("transfer") || m.includes("online");
          if (target.includes("card")) return m.includes("card");
          return m === target;
        });
      } else {
        list = allExp;
      }
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((item: any) =>
      (item.customer || item.customerName || "").toLowerCase().includes(q) ||
      (item.id || item.invoiceNumber || item.expenseNo || "").toLowerCase().includes(q) ||
      (item.category || "").toLowerCase().includes(q) ||
      (item.description || "").toLowerCase().includes(q) ||
      (item.paymentMode || "").toLowerCase().includes(q)
    );
  };

  // Trigger Official Invoice Section Print & Preview
  const handlePrintTrigger = (inv: any) => {
    const docNo = inv.invoiceNumber || inv.id || inv._id;
    if (docNo) {
      router.push(`/invoice?id=${encodeURIComponent(docNo)}`);
    }
  };

  if (status === "loading") {
    return (
      <div className="page-container space-y-6 pb-10 animate-pulse">
        <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <MetricCardsShimmer />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartShimmer />
          <ChartShimmer />
        </div>
      </div>
    );
  }

  if (userRole === "driver" || userRole === "warehouse" || userRole === "supplier") {
    return (
      <div className="page-container space-y-4 pb-10 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-4 border-[#30539C] border-t-transparent rounded-full" />
        <p className="text-xs text-slate-500 font-bold tracking-wide">Opening your role portal...</p>
      </div>
    );
  }

  if (userRole === "salesman" || userRole === "sales" || userRole === "salesperson" || userRole === "sales_executive") {
    return (
      <div className="page-container pb-10">
        <SalesmanDashboardView session={session} />
      </div>
    );
  }

  return (
    <div className="page-container space-y-5 pb-10">
      {/* ─── PENDING INVENTORY AUDIT WARNING BANNER ──────────────── */}
      {isAuditPending && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 animate-bounce flex-shrink-0" />
            <div>
              <p className="text-xs font-black text-amber-900 uppercase tracking-wide">Daily Inventory Audit Required</p>
              <p className="text-[11px] text-amber-800">Physical stock count for today has not been conducted. Complete the showroom check to ensure zero leakage.</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => router.push("/inventory/audit")}
            className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex-shrink-0"
          >
            Perform Daily Audit <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* ─── HEADER WITH PERIOD FILTER TABS ────────────────────────── */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white px-5 py-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Value Plus Live ERP
              </h1>
              {isOffline ? (
                <Badge className="bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] px-2 py-0.5 flex items-center gap-1">
                  <WifiOff className="w-3 h-3 text-amber-700" /> Offline (Cached)
                </Badge>
              ) : isUsingCachedData ? (
                <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[10px] px-2 py-0.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-600" /> Live Data
                </Badge>
              ) : (
                <Badge className="bg-blue-50 text-[#3F63AD] border border-blue-200 font-medium text-[10px] px-2 py-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">Ashoka Enterprises, Gorakhpur • Real-Time Counter Overview</p>
          </div>
        </div>

        {/* UNIVERSAL TIME FILTER & QUICK ACTIONS */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          <DateRangeFilter 
            value={dateFilter} 
            onChange={handleUniversalFilterChange} 
            showIcon={true} 
            className="w-[150px] h-8 text-xs font-semibold" 
          />
          <Button 
            onClick={() => router.push("/sales/invoices")}
            variant="outline"
            className="h-8 px-3 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Receipt className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Invoices
          </Button>
          <Button 
            onClick={handleOpenInvoiceModal} 
            className="h-8 px-4 rounded-lg font-bold bg-[#76C043] hover:bg-[#60a82c] text-white shadow-sm transition-all border-none text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Bill
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* ═══════════════════════════════════════════════════════════════════════════════
            🏆 POOL A: PAYMENT & BILL DISTRIBUTION + SALES & ORDER TRENDS + KEY KPIs +
            PAYMENT LEAKAGE + ALERT CENTER — a manually-balanced 3-column layout, not CSS
            `columns-N` auto-balance. Auto-balance for an auto-height multicol container is
            inconsistent across browsers (some just fill column 1 and dump the rest into
            column 2/3 instead of truly balancing), which is exactly the empty-column bug
            seen in testing. Explicit column groups here are sized by hand so the result is
            deterministic: [Payment] | [Trends+Trends KPIs+Purchase KPIs] | [Leakage+Alerts].
        ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {/* COLUMN 1: PAYMENT & BILL DISTRIBUTION WITH DONUT */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="pb-2.5 border-b border-slate-100 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#3F63AD] shrink-0">
                  <PieChartIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-black text-slate-900 tracking-tight truncate">
                    Payment & Bill Distribution
                  </h2>
                  <p className="text-xs text-slate-500 font-medium truncate">Channel-wise collection & revenue share</p>
                </div>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold px-2 py-0.5">
                  {totalBilledCount} Total Bills
                </Badge>
                <DateRangeFilter
                  value={widgetFilters.pie}
                  onChange={(val, start, end) => handleWidgetFilterChange('pie', val, start, end)}
                  className="flex-1 min-w-[115px] h-8 text-xs font-semibold"
                />
              </div>
            </div>

            {/* ─── TOTAL SALES SUMMARY PANEL (STACKED BAR + CHANNEL ROWS) ─── */}
            <div className="py-2">
              <div className="bg-slate-100/70 rounded-xl p-3">
                {/* HEADLINE */}
                <div
                  onClick={() => router.push(`/dashboard/reports?type=all&dateFilter=${encodeURIComponent(widgetFilters.pie)}`)}
                  className="cursor-pointer group"
                  title="View full ledger"
                >
                  <p className="text-sm font-bold text-slate-900 group-hover:text-[#3F63AD] transition-colors">Total Sales</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {pieRangeLabel} • {totalBilledCount} {totalBilledCount === 1 ? "order" : "orders"}
                  </p>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2 leading-none">
                    ₹ {formatNumber(Math.round(totalCollectedAmount))}
                  </p>
                </div>

                {/* SEGMENTED DISTRIBUTION BAR */}
                <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-slate-300/70 mt-4">
                  {totalCollectedAmount > 0 ? (
                    PAYMENT_MODES.filter((m) => m.value > 0).map((m) => (
                      <div
                        key={m.key}
                        title={`${m.name} — ${formatCurrency(m.value)}`}
                        className="h-full transition-all"
                        style={{
                          width: `${(m.value / totalCollectedAmount) * 100}%`,
                          backgroundColor: m.color,
                        }}
                      />
                    ))
                  ) : (
                    <div className="h-full w-full bg-slate-300" />
                  )}
                </div>

                {/* CHANNEL ROWS */}
                <div className="mt-3 divide-y divide-slate-200/90">
                  {PAYMENT_MODES.map((item) => {
                    const share = totalCollectedAmount > 0 ? (item.value / totalCollectedAmount) * 100 : 0;
                    return (
                      <div
                        key={item.key}
                        onClick={() => router.push(`/dashboard/reports?type=${item.key}&dateFilter=${encodeURIComponent(widgetFilters.pie)}`)}
                        className="flex items-center justify-between gap-3 py-1.5 cursor-pointer group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-sm font-semibold text-slate-700 truncate group-hover:text-[#3F63AD] transition-colors">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white/80 border border-slate-200 rounded px-1.5 py-0.5">
                            {item.count}
                          </span>
                          <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                            ₹ {formatNumber(Math.round(item.value))}
                          </span>
                          <span className="text-xs font-medium text-slate-400 font-mono tabular-nums w-11 text-right">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}

                </div>

                {/* ─── KHATA STATUS LINES ─────────────────────────────────────
                    These sit BELOW the bar, not inside it. Money collected against
                    a due is already counted in the Cash/UPI/Card/Online row it came
                    through, so showing it as its own segment would count the same
                    rupees twice — which is exactly what the old duplicated
                    "Pending Due" row did. */}
                {(dueClearedRevenue > 0 || allTimeDueOutstanding > 0) && (
                  <div className="mt-3 pt-3 border-t border-slate-200/90 space-y-2">
                    {dueClearedRevenue > 0 && (
                      <div
                        onClick={() => setActiveModal("due")}
                        className="flex items-center justify-between gap-3 cursor-pointer group"
                        title="Khata payments received in this period — already included in the payment mode above"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          <span className="text-xs font-semibold text-emerald-800 group-hover:underline">
                            Dues Collected
                          </span>
                          {dueClearedModeSummary && (
                            <span className="text-[11px] text-slate-400 truncate">via {dueClearedModeSummary}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            {metrics.dueClearedCount || 0}
                          </span>
                          <span className="text-sm font-bold text-emerald-700 font-mono tabular-nums">
                            + ₹ {formatNumber(Math.round(dueClearedRevenue))}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* All-time khata outstanding. The "Due / Credit Bill" bar segment
                        above already shows what is unpaid IN THIS PERIOD, so repeating
                        that here is what produced the two identical rows. This instead
                        reports the running khata book across every period. */}
                    {allTimeDueOutstanding > 0 && (
                      <div
                        onClick={() => {
                          const activeDate = dateFilter || "Today";
                          let url = `/reports/sales-out?dueOnly=true&dateFilter=${encodeURIComponent(activeDate)}`;
                          if (startDate && endDate) url += `&startDate=${startDate}&endDate=${endDate}`;
                          router.push(url);
                        }}
                        className="flex items-center justify-between gap-3 cursor-pointer group"
                        title="Total khata still owed across all periods — falls as customers settle"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse" />
                          <span className="text-xs font-semibold text-rose-700 group-hover:underline">
                            Khata book — total still owed
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                            {allTimeDueCount}
                          </span>
                          <span className="text-sm font-bold text-rose-700 font-mono tabular-nums">
                            ₹ {formatNumber(Math.round(allTimeDueOutstanding))}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TOP CHANNEL FOOTNOTE */}
                <p className="text-xs text-slate-400 font-medium mt-3">
                  {topPaymentMode && topPaymentMode.value > 0 ? (
                    <>— {topPaymentMode.name} — <span className="text-slate-600 font-semibold">₹ {formatNumber(Math.round(topPaymentMode.value))}</span> this period</>
                  ) : (
                    <>— No collections recorded this period</>
                  )}
                </p>
              </div>
            </div>

            {/* EXTENDED WARRANTY HIGHLIGHT STRIP */}
            <div 
              onClick={() => router.push("/sales/invoices")}
              className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-emerald-100/80 transition-all mt-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black text-emerald-950 text-xs sm:text-sm">Extended Warranty Add-ons</p>
                  <p className="text-xs text-emerald-800 font-semibold">{warrantyData.totalCount || metrics.warrantyCount || 0} Policies Sold • {warrantyData.conversionRate || 0}% Conversion</p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-black text-emerald-900 font-mono text-sm sm:text-base block">
                  {formatCurrency(warrantyData.totalSales || metrics.warrantyRevenue || 0)}
                </span>
                <span className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1">
                  View Bills <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: SALES & ORDER TRENDS + KEY BUSINESS SNAPSHOT + OPERATIONAL SNAPSHOT */}
          <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="pb-2.5 border-b border-slate-100 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600 shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                    Sales & Order Trends
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate">Hourly & daily sales volume</p>
                </div>
              </div>
              <DateRangeFilter
                value={widgetFilters.trends}
                onChange={(val, start, end) => handleWidgetFilterChange('trends', val, start, end)}
                className="w-full h-8 text-xs font-semibold"
              />
            </div>

            <div className="h-[190px] w-full pt-3">
              {widgetLoading.trends ? (
                <div className="w-full h-full flex items-center justify-center animate-pulse">
                  <div className="h-36 w-full bg-slate-100 rounded-xl"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={widgetData.trends?.dailyRevenue || DAILY_REVENUE} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTrends" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#76C043" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#76C043" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3F63AD" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3F63AD" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11, fontWeight: "bold" }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={(val) => `₹${val > 99999 ? (val/100000).toFixed(1)+'L' : val > 999 ? (val/1000).toFixed(0)+'k' : val}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Total Revenue" stroke="#76C043" strokeWidth={3} fillOpacity={1} fill="url(#colorTrends)" />
                    <Area type="monotone" dataKey="online" name="Online & Card" stroke="#3F63AD" strokeWidth={2.5} fillOpacity={1} fill="url(#colorOnline)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#76C043] shrink-0" /> Total Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3F63AD] shrink-0" /> Digital</span>
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 ml-auto">
                <Clock className="w-3 h-3" /> Peak: 1-3PM
              </span>
            </div>
          </div>

          {/* CARD 3A + 3B: two independent compact KPI cards — each flows on
              its own into whichever column the balancer picks (they used to
              be force-paired in one stacked wrapper; letting them separate
              gives the multi-column balancer more freedom to avoid gaps). */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                    Key Business Snapshot
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate">Core revenue, bills & purchase KPIs</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 py-1">
                {[
                  {
                    label: "Gross Sales",
                    value: formatCurrency((kpiMetrics.cashRevenue || 0) + (kpiMetrics.onlineRevenue || 0) + (kpiMetrics.financeRevenue || 0) + (kpiMetrics.upiRevenue || 0) + (kpiMetrics.cardRevenue || 0)),
                    icon: TrendingUp,
                    color: "text-[#76C043]",
                    onClick: () => router.push(`/dashboard/reports?type=all&dateFilter=${widgetFilters.kpi}`),
                  },
                  {
                    label: "Total Bills",
                    value: `${kpiMetrics.totalOrders || 0}`,
                    icon: Receipt,
                    color: "text-blue-600",
                    onClick: () => router.push(`/dashboard/reports?type=orders&dateFilter=${widgetFilters.kpi}`),
                  },
                  {
                    label: "Avg Order Value",
                    value: formatCurrency(kpiMetrics.totalOrders ? (((kpiMetrics.cashRevenue || 0) + (kpiMetrics.onlineRevenue || 0) + (kpiMetrics.financeRevenue || 0) + (kpiMetrics.upiRevenue || 0) + (kpiMetrics.cardRevenue || 0)) / kpiMetrics.totalOrders) : 0),
                    icon: IndianRupee,
                    color: "text-indigo-600",
                    onClick: () => router.push(`/dashboard/reports?type=aov&dateFilter=${widgetFilters.kpi}`),
                  },
                  {
                    label: "Avg Purchase Value",
                    value: formatCurrency(kpiMetrics.avgPurchaseValue || 0),
                    icon: ShoppingCart,
                    color: "text-amber-600",
                    onClick: () => router.push("/purchase/entries"),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    onClick={row.onClick}
                    className="flex items-center justify-between gap-2 py-2 cursor-pointer group"
                  >
                    <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                      <row.icon className={`w-3.5 h-3.5 shrink-0 ${row.color}`} />
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900 shrink-0">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3B: OPERATIONAL SNAPSHOT — fills the rest of the column with more real numbers */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 tracking-tight truncate">
                    Operational Snapshot
                  </h3>
                  <p className="text-xs text-slate-500 font-medium truncate">Stock, expenses & outstanding dues</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 py-1">
                {[
                  {
                    label: "Total Stock Value",
                    value: formatCurrency(stockBreakdown.totalStockValue || 0),
                    icon: Package,
                    color: "text-[#3F63AD]",
                    onClick: () => { setStockGroupFilter("all"); setStockCategoryFilter("all"); setOpenStockModal(true); },
                  },
                  {
                    label: "Total Expenses",
                    value: formatCurrency(metrics.totalExpenses || 0),
                    icon: Receipt,
                    color: "text-rose-600",
                    onClick: () => { setExpenseModalModeFilter("all"); setActiveModal("expenses"); },
                  },
                  {
                    label: "Net Profit",
                    value: formatCurrency(metrics.netProfit || 0),
                    icon: TrendingUp,
                    color: (metrics.netProfit || 0) >= 0 ? "text-emerald-600" : "text-rose-600",
                    onClick: () => router.push("/accounting/profit-loss"),
                  },
                  {
                    label: "Khata Outstanding",
                    value: formatCurrency(allTimeDueOutstanding || 0),
                    icon: AlertTriangle,
                    color: "text-amber-600",
                    onClick: () => setActiveModal("due"),
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    onClick={row.onClick}
                    className="flex items-center justify-between gap-2 py-2 cursor-pointer group"
                  >
                    <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                      <row.icon className={`w-3.5 h-3.5 shrink-0 ${row.color}`} />
                      <span className="truncate">{row.label}</span>
                    </span>
                    <span className="text-sm font-black font-mono text-slate-900 shrink-0">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUMN 3: PAYMENT LEAKAGE & VOID AUDIT + ALERT CENTER */}
          <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200/60 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Payment Leakage & Void Audit
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                      Live Audit
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Security tracker for cancelled bills, shifted orders, price/qty tampering & reprints</p>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setLeakageModal({ type: "all", title: "All Leakage & Security Logs", description: "Audit trail of all void entries, bill mutations and waivers", invoices: recentInvoices, color: "#EF4444" })}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 px-3"
              >
                Full Audit →
              </Button>
            </div>

            {/* 5 LEAKAGE SORT BOXES GRID (PETPOOJA STYLE) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-3">
              {/* 1. CANCELLED */}
              <div
                onClick={() => setLeakageModal({
                  type: "cancelled",
                  title: "Cancelled Bills & Orders",
                  description: "Bills that were cancelled or voided at billing counter",
                  invoices: leakage.cancelled?.invoices || [],
                  color: "#EF4444"
                })}
                className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-100/60 hover:border-red-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Cancelled</span>
                  <Badge className="bg-red-200 text-red-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.cancelled?.count || 0} Bills
                  </Badge>
                </div>
                <p className="text-sm font-black text-red-600 font-mono my-0.5">
                  {formatCurrency(leakage.cancelled?.amount || 0)}
                </p>
                <span className="text-xs text-red-700 font-semibold flex items-center justify-between pt-1.5 border-t border-red-200/60">
                  <span>Void sales</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              {/* 2. DELETED — read from the archive, since the invoice itself is gone */}
              <div
                onClick={() => setLeakageModal({
                  type: "deleted",
                  title: "Deleted Bills",
                  description: "Invoices and estimates removed from the system. The full record is archived with the reason and who authorised it.",
                  invoices: leakage.deleted?.invoices || [],
                  color: "#B91C1C"
                })}
                className="p-2.5 rounded-lg border border-red-300 bg-red-100/40 hover:bg-red-100 hover:border-red-500 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-red-900 uppercase tracking-wider">Deleted</span>
                  <Badge className="bg-red-300 text-red-950 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.deleted?.count || 0} Docs
                  </Badge>
                </div>
                <p className="text-sm font-black text-red-700 font-mono my-0.5">
                  {formatCurrency(leakage.deleted?.amount || 0)}
                </p>
                <span className="text-xs text-red-800 font-semibold flex items-center justify-between pt-1.5 border-t border-red-300/60">
                  <span>Bills &amp; estimates</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              {/* 3. SHIFTED */}
              <div
                onClick={() => setLeakageModal({
                  type: "shifted",
                  title: "Shifted Bills & Orders",
                  description: "Orders transferred across counter, terminals or sales orders",
                  invoices: leakage.shifted?.invoices || [],
                  color: "#3B82F6"
                })}
                className="p-2.5 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/60 hover:border-blue-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Shifted</span>
                  <Badge className="bg-blue-200 text-blue-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.shifted?.count || 0} Orders
                  </Badge>
                </div>
                <p className="text-sm font-black text-blue-700 font-mono my-0.5">
                  {formatCurrency(leakage.shifted?.amount || 0)}
                </p>
                <span className="text-xs text-blue-800 font-semibold flex items-center justify-between pt-1.5 border-t border-blue-200/60">
                  <span>Transfers</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              {/* 4. BILLS MODIFIED */}
              <div
                onClick={() => setLeakageModal({
                  type: "billsModified",
                  title: "Bills Modified Post-Punching",
                  description: "Invoices where rates, discounts or quantities were altered",
                  invoices: leakage.billsModified?.invoices || [],
                  color: "#F97316"
                })}
                className="p-2.5 rounded-lg border border-orange-200 bg-orange-50/50 hover:bg-orange-100/60 hover:border-orange-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-orange-800 uppercase tracking-wider">Bills Modified</span>
                  <Badge className="bg-orange-200 text-orange-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.billsModified?.count || 0} Bills
                  </Badge>
                </div>
                <p className="text-sm font-black text-orange-700 font-mono my-0.5">
                  {formatCurrency(leakage.billsModified?.amount || 0)}
                </p>
                <span className="text-xs text-orange-800 font-semibold flex items-center justify-between pt-1.5 border-t border-orange-200/60">
                  <span>Price diff</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              {/* 5. RE-PRINTED */}
              <div
                onClick={() => setLeakageModal({
                  type: "reprinted",
                  title: "Re-printed Tax Invoices",
                  description: "Invoices printed multiple times (fraud & duplicate check)",
                  invoices: leakage.reprinted?.invoices || [],
                  color: "#6366F1"
                })}
                className="p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 hover:border-indigo-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider">Re-printed</span>
                  <Badge className="bg-indigo-200 text-indigo-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.reprinted?.totalPrints || leakage.reprinted?.count || 0} Prints
                  </Badge>
                </div>
                <p className="text-sm font-black text-indigo-700 font-mono my-0.5">
                  {leakage.reprinted?.count || 0} Invoices
                </p>
                <span className="text-xs text-indigo-800 font-semibold flex items-center justify-between pt-1.5 border-t border-indigo-200/60">
                  <span>Audit prints</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>

              {/* 6. WAIVED OFF */}
              <div
                onClick={() => setLeakageModal({
                  type: "waivedOff",
                  title: "Waived Off & Comp Reductions",
                  description: "Manual discounts given, round-off reductions and settled balance waivers",
                  invoices: leakage.waivedOff?.invoices || [],
                  color: "#10B981"
                })}
                className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 hover:border-emerald-400 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Waived Off</span>
                  <Badge className="bg-emerald-200 text-emerald-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {leakage.waivedOff?.count || 0} Entries
                  </Badge>
                </div>
                <p className="text-sm font-black text-emerald-700 font-mono my-0.5">
                  {formatCurrency(leakage.waivedOff?.amount || 0)}
                </p>
                <span className="text-xs text-emerald-800 font-semibold flex items-center justify-between pt-1.5 border-t border-emerald-200/60">
                  <span>Discounts</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Security monitoring active</span>
              <span className="font-bold text-slate-700">Zero fraud protocol enabled</span>
            </div>
          </div>

          {/* CARD 2 (RIGHT): ALERT CENTER & QUICK ACTION PASTEL BUTTONS */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Alert Center & Quick Actions
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Operational priorities & 1-click counter management</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                Live Store
              </span>
            </div>

            {/* ALERTS LIST */}
            <div className="space-y-2.5 py-2.5">
              <div 
                onClick={() => router.push("/reports/sales-out?dueOnly=true")}
                className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer hover:bg-rose-100/70 transition-all text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="font-bold text-rose-950 text-xs sm:text-sm">{metrics.dueCount || 0} Pending Due Invoices</span>
                </div>
                <Badge className="bg-rose-200 text-rose-900 text-xs font-bold border-none">High Priority</Badge>
              </div>

              <div 
                onClick={() => router.push("/masters/items")}
                className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200 cursor-pointer hover:bg-amber-100/70 transition-all text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-bold text-amber-950 text-xs sm:text-sm">{metrics.lowStockItems || 0} Low Stock Products Need Reorder</span>
                </div>
                <Badge className="bg-amber-200 text-amber-900 text-xs font-bold border-none">Medium</Badge>
              </div>

              <div 
                onClick={() => setLeakageModal({
                  type: "reprinted",
                  title: "Re-printed Tax Invoices",
                  description: "Invoices printed multiple times",
                  invoices: leakage.reprinted?.invoices || [],
                  color: "#6366F1"
                })}
                className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 cursor-pointer hover:bg-indigo-100/70 transition-all text-xs sm:text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="font-bold text-indigo-950 text-xs sm:text-sm">{leakage.reprinted?.count || 0} Tax Bills Re-printed Today</span>
                </div>
                <Badge className="bg-indigo-200 text-indigo-900 text-xs font-bold border-none">Security Log</Badge>
              </div>
            </div>

            {/* QUICK ACTIONS GRID (PASTEL BUTTONS) */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Quick Actions</span>
              <div className="grid grid-cols-3 gap-2.5">
                <Button
                  onClick={handleOpenInvoiceModal}
                  size="sm"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 h-9 text-xs font-bold shadow-none"
                >
                  <Receipt className="w-3.5 h-3.5 mr-1.5 text-emerald-700" /> New Bill
                </Button>
                <Button
                  onClick={() => setOpenPaymentModal(true)}
                  size="sm"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 h-9 text-xs font-bold shadow-none"
                >
                  <IndianRupee className="w-3.5 h-3.5 mr-1.5 text-blue-700" /> Payment
                </Button>
                <Button
                  onClick={() => router.push("/inventory/audit")}
                  size="sm"
                  className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 h-9 text-xs font-bold shadow-none"
                >
                  <Package className="w-3.5 h-3.5 mr-1.5 text-amber-700" /> Audit
                </Button>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════
            🤝 VENDOR & SUPPLIER LEDGER SUMMARY

            Deliberately its own full-width row rather than folded into the revenue and
            expense cards above. Vendor money in is not a counter sale, and a supplier
            payout settles a liability the purchase already expensed — merging either
            would change every figure on this dashboard and understate net profit. Its
            4-tile ledger grid also genuinely needs full width to stay readable, so it
            sits between the two manually-balanced column pools rather than inside one.
        ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 hover:shadow-md transition-all">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Vendor &amp; Supplier Ledger
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Money in from vendors and money out to suppliers, tracked apart from counter sales
                </p>
              </div>
            </div>
            <Link
              href="/vendors/ledger"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 px-3 rounded-md inline-flex items-center"
            >
              Open Ledgers →
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-3.5">
            {/* VENDOR COLLECTIONS — with the mode split the counter actually used */}
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Vendor Collections
                </span>
                <Badge className="bg-emerald-200 text-emerald-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                  {vendorSupplier.vendorCollections.count}
                </Badge>
              </div>
              <p className="text-lg font-black text-emerald-700 font-mono">
                {formatCurrency(vendorSupplier.vendorCollections.total)}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-200/60 grid grid-cols-2 gap-x-2 gap-y-0.5">
                {[
                  ["Cash", vendorSupplier.vendorCollections.byMode?.cash],
                  ["UPI", vendorSupplier.vendorCollections.byMode?.upi],
                  ["NEFT/IMPS", vendorSupplier.vendorCollections.byMode?.online],
                  ["Card", vendorSupplier.vendorCollections.byMode?.card],
                ].map(([label, value]: any) => (
                  <div key={label} className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-700 font-semibold">{label}</span>
                    <span className="font-mono font-bold text-emerald-900">
                      {formatCurrency(Number(value) || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* VENDOR DUE */}
            <Link
              href="/vendors/outstanding"
              className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 hover:bg-amber-100/60 hover:border-amber-400 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Vendor Due
                  </span>
                  <Badge className="bg-amber-200 text-amber-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {vendorSupplier.vendorDue.count} Parties
                  </Badge>
                </div>
                <p className="text-lg font-black text-amber-700 font-mono">
                  {formatCurrency(vendorSupplier.vendorDue.total)}
                </p>
              </div>
              <span className="text-[11px] text-amber-800 font-semibold flex items-center justify-between pt-2 mt-2 border-t border-amber-200/60">
                <span>Overdue {formatCurrency(vendorSupplier.vendorDue.overdue)}</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>

            {/* SUPPLIER PAYOUTS — money out, kept out of the Expense card on purpose */}
            <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/50 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                  Supplier Payouts
                </span>
                <p className="text-lg font-black text-sky-700 font-mono mt-1">
                  {formatCurrency(metrics.supplierPayouts || 0)}
                </p>
              </div>
              <div className="pt-2 mt-2 border-t border-sky-200/60 space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sky-700 font-semibold">Operating expense</span>
                  <span className="font-mono font-bold text-sky-900">
                    {formatCurrency(metrics.totalExpenses || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sky-800 font-bold">Total money out</span>
                  <span className="font-mono font-black text-sky-950">
                    {formatCurrency((metrics.totalExpenses || 0) + (metrics.supplierPayouts || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* SUPPLIER OUTSTANDING */}
            <Link
              href="/vendors/outstanding"
              className="p-3 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 hover:border-rose-400 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    We Still Owe
                  </span>
                  <Badge className="bg-rose-200 text-rose-900 text-[10px] font-black px-1.5 py-0.5 border-none">
                    {vendorSupplier.supplierOutstanding.count} Suppliers
                  </Badge>
                </div>
                <p className="text-lg font-black text-rose-700 font-mono">
                  {formatCurrency(vendorSupplier.supplierOutstanding.total)}
                </p>
              </div>
              <span className="text-[11px] text-rose-800 font-semibold flex items-center justify-between pt-2 mt-2 border-t border-rose-200/60">
                <span>Supplier payables</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          </div>

          <p className="text-[10px] text-slate-400 pt-3 mt-1 border-t border-slate-100 leading-relaxed">
            These figures are reported separately and are not included in Total Revenue, Total
            Expenses or Net Profit above: a supplier payout settles a bill the purchase already
            expensed, and vendor collections are not counter sales.
          </p>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════
            📊 POOL B: KEY BUSINESS METRICS + EXPENSES + CATEGORY STOCK + SALES STAFF
            LEADERBOARD + TOP SELLING PRODUCTS — manually balanced (same reasoning as
            Pool A): [KeyBiz+Expense] | [CategoryStock] | [SalesLeaderboard+TopSelling].
        ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {/* COLUMN 1: KEY BUSINESS PERFORMANCE + EXPENSE & CASH WITHDRAWAL */}
          <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#3F63AD]">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Key Business Performance</h3>
                  <p className="text-xs text-slate-500 font-medium">Core showroom revenue, bills count and average ticket size</p>
                </div>
              </div>
              <DateRangeFilter
                value={widgetFilters.kpi}
                onChange={(val, start, end) => handleWidgetFilterChange('kpi', val, start, end)}
                className="w-[115px] h-8 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 py-3">
              {/* GROSS SALES */}
              <div
                onClick={() => router.push(`/dashboard/reports?type=all&dateFilter=${widgetFilters.kpi}`)}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#76C043] hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Sales</span>
                  <IndianRupee className="w-4 h-4 text-[#76C043]" />
                </div>
                <p className="text-lg font-black text-slate-900 font-mono">
                  {formatCurrency((kpiMetrics.cashRevenue || 0) + (kpiMetrics.onlineRevenue || 0) + (kpiMetrics.financeRevenue || 0) + (kpiMetrics.upiRevenue || 0) + (kpiMetrics.cardRevenue || 0))}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> +12.4% vs last</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* TOTAL BILLS */}
              <div
                onClick={() => router.push(`/dashboard/reports?type=orders&dateFilter=${widgetFilters.kpi}`)}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Bills</span>
                  <Receipt className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-lg font-black text-slate-900 font-mono">
                  {kpiMetrics.totalOrders || 0} <span className="text-sm font-normal text-slate-500">Invoices</span>
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-semibold text-amber-600">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Peak: 1PM-3PM</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* AOV */}
              <div
                onClick={() => router.push(`/dashboard/reports?type=aov&dateFilter=${widgetFilters.kpi}`)}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-indigo-500 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Order Value (AOV)</span>
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-lg font-black text-slate-900 font-mono">
                  {formatCurrency(kpiMetrics.totalOrders ? (((kpiMetrics.cashRevenue || 0) + (kpiMetrics.onlineRevenue || 0) + (kpiMetrics.financeRevenue || 0) + (kpiMetrics.upiRevenue || 0) + (kpiMetrics.cardRevenue || 0)) / kpiMetrics.totalOrders) : 0)}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Revenue per bill</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* AVERAGE PURCHASE — purchase-side counterpart to AOV */}
              <div
                onClick={() => router.push("/purchase/entries")}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-amber-500 hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Purchase Value</span>
                  <ShoppingCart className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-lg font-black text-slate-900 font-mono">
                  {formatCurrency(kpiMetrics.avgPurchaseValue || 0)}
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>{kpiMetrics.totalPurchaseBills || 0} supplier bill{kpiMetrics.totalPurchaseBills === 1 ? "" : "s"}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* TOTAL STOCKS */}
              <div
                onClick={() => { setStockGroupFilter("all"); setStockCategoryFilter("all"); setOpenStockModal(true); }}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#3F63AD] hover:shadow-sm transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stocks</span>
                  <Package className="w-4 h-4 text-[#3F63AD]" />
                </div>
                <p className="text-lg font-black text-slate-900 font-mono">
                  {stockBreakdown.totalQuantity > 0 ? stockBreakdown.totalQuantity.toLocaleString("en-IN") : (metrics.totalItems || 0)} <span className="text-sm font-normal text-slate-500">Units</span>
                </p>
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-[#3F63AD]">
                  <span>₹{((stockBreakdown.totalStockValue || 0) / 10000000).toFixed(2)} Cr Valuation</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Updated in real time</span>
              <span className="font-bold text-slate-700">Gorakhpur Store Ledger</span>
            </div>
          </div>

          {/* CARD 2 (RIGHT): SHOWROOM OPERATING EXPENSES & CASH WITHDRAWAL (COMPACT & BALANCED) */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            {/* 1. HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-50 to-red-100 border border-rose-200/80 flex items-center justify-center text-rose-600 shadow-sm">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Expense & Cash Withdrawal
                    <span 
                      onClick={() => { setExpenseModalModeFilter("all"); setActiveModal("expenses"); }}
                      className="text-xs font-bold text-rose-700 font-mono bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 cursor-pointer hover:bg-rose-100 transition-colors"
                      title="Click to view full expense ledger"
                    >
                      {formatCurrency(widgetData.expenses?.expenses?.total || widgetData.expenses?.metrics?.totalExpenses || data?.expenses?.total || 0)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Counter cash & digital withdrawals by purpose & channel</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <DateRangeFilter 
                  value={widgetFilters.expenses} 
                  onChange={(val, start, end) => handleWidgetFilterChange('expenses', val, start, end)}
                  className="w-[110px] h-8 text-xs font-semibold"
                />
                <Button 
                  size="sm" 
                  onClick={() => router.push("/purchase/expenses")} 
                  className="bg-[#30539C] hover:bg-[#1E3A8A] text-white font-bold text-xs h-8 px-3 rounded-lg shadow-sm transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Record
                </Button>
              </div>
            </div>

            {/* 2. COMPACT EXECUTIVE BODY */}
            {(() => {
              const expTotal = Number(widgetData.expenses?.expenses?.total || widgetData.expenses?.metrics?.totalExpenses || data?.expenses?.total || 0);
              const grossSales = Number(widgetData.expenses?.metrics?.totalRevenue || totalCollectedAmount || 1);
              const ratio = grossSales > 0 ? ((expTotal / grossSales) * 100).toFixed(1) : "0.0";
              const categories = widgetData.expenses?.expenses?.categories || data?.expenses?.categories || [];
              const modes = widgetData.expenses?.expenses?.modes || data?.expenses?.modes || [];
              const recentVouchers = widgetData.expenses?.expenses?.recent || data?.expenses?.recent || [];
              const allVouchers = widgetData.expenses?.expenses?.all || widgetData.expenses?.expenses?.recent || data?.expenses?.all || data?.expenses?.recent || [];

              const cashExp = Number(widgetData.expenses?.expenses?.cash ?? (modes.find((m: any) => m.mode?.toLowerCase() === "cash")?.amount || 0));
              const upiExp = Number(widgetData.expenses?.expenses?.upi ?? (modes.find((m: any) => m.mode?.toLowerCase() === "upi")?.amount || 0));
              const bankExp = Number(widgetData.expenses?.expenses?.bank ?? (modes.find((m: any) => m.mode?.toLowerCase()?.includes("bank"))?.amount || 0));
              const cardExp = Number(widgetData.expenses?.expenses?.card ?? (modes.find((m: any) => m.mode?.toLowerCase()?.includes("card"))?.amount || 0));

              // Default categories if empty
              const displayCategories = categories.length > 0 ? categories : [
                { category: "Store Operations & Maintenance", amount: 0, percentage: 0 },
                { category: "Staff Refreshments & Tea", amount: 0, percentage: 0 },
              ];

              const displayModes = modes.length > 0 ? modes : [
                { mode: "Cash Counter", amount: cashExp, percentage: expTotal > 0 ? Math.round((cashExp / expTotal) * 100) : 0 },
                { mode: "UPI / QR", amount: upiExp, percentage: expTotal > 0 ? Math.round((upiExp / expTotal) * 100) : 0 },
              ];

              return (
                <div className="py-2.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  {/* A. 4-MODE COMPACT OUTFLOW ROW */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* Cash */}
                    <div 
                      onClick={() => { setExpenseModalModeFilter("Cash"); setActiveModal("expenses"); }}
                      className="bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/60 rounded-lg p-1.5 cursor-pointer transition-all group text-left"
                    >
                      <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold">
                        <span className="flex items-center gap-1"><Wallet className="w-2.5 h-2.5" /> Cash</span>
                        <span className="font-mono text-[9px] bg-white px-1 py-0.2 rounded border border-emerald-200">{expTotal > 0 ? Math.round((cashExp / expTotal) * 100) : 0}%</span>
                      </div>
                      <p className="text-[11px] font-mono font-black text-slate-900 mt-0.5">{formatCurrency(cashExp)}</p>
                    </div>

                    {/* UPI */}
                    <div 
                      onClick={() => { setExpenseModalModeFilter("UPI"); setActiveModal("expenses"); }}
                      className="bg-purple-50/50 hover:bg-purple-50 border border-purple-200/60 rounded-lg p-1.5 cursor-pointer transition-all group text-left"
                    >
                      <div className="flex items-center justify-between text-[10px] text-purple-800 font-bold">
                        <span className="flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> UPI</span>
                        <span className="font-mono text-[9px] bg-white px-1 py-0.2 rounded border border-purple-200">{expTotal > 0 ? Math.round((upiExp / expTotal) * 100) : 0}%</span>
                      </div>
                      <p className="text-[11px] font-mono font-black text-slate-900 mt-0.5">{formatCurrency(upiExp)}</p>
                    </div>

                    {/* Bank */}
                    <div 
                      onClick={() => { setExpenseModalModeFilter("Bank Transfer"); setActiveModal("expenses"); }}
                      className="bg-blue-50/50 hover:bg-blue-50 border border-blue-200/60 rounded-lg p-1.5 cursor-pointer transition-all group text-left"
                    >
                      <div className="flex items-center justify-between text-[10px] text-blue-800 font-bold">
                        <span className="flex items-center gap-1"><Building2 className="w-2.5 h-2.5" /> Bank</span>
                        <span className="font-mono text-[9px] bg-white px-1 py-0.2 rounded border border-blue-200">{expTotal > 0 ? Math.round((bankExp / expTotal) * 100) : 0}%</span>
                      </div>
                      <p className="text-[11px] font-mono font-black text-slate-900 mt-0.5">{formatCurrency(bankExp)}</p>
                    </div>

                    {/* Card */}
                    <div 
                      onClick={() => { setExpenseModalModeFilter("Card"); setActiveModal("expenses"); }}
                      className="bg-cyan-50/50 hover:bg-cyan-50 border border-cyan-200/60 rounded-lg p-1.5 cursor-pointer transition-all group text-left"
                    >
                      <div className="flex items-center justify-between text-[10px] text-cyan-800 font-bold">
                        <span className="flex items-center gap-1"><CreditCard className="w-2.5 h-2.5" /> Card</span>
                        <span className="font-mono text-[9px] bg-white px-1 py-0.2 rounded border border-cyan-200">{expTotal > 0 ? Math.round((cardExp / expTotal) * 100) : 0}%</span>
                      </div>
                      <p className="text-[11px] font-mono font-black text-slate-900 mt-0.5">{formatCurrency(cardExp)}</p>
                    </div>
                  </div>

                  {/* B. PURPOSE & MODE BREAKDOWN GRID */}
                  <div className="bg-slate-50/60 border border-slate-200/70 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center bg-slate-200/70 p-0.5 rounded-md text-[10px]">
                        <button
                          type="button"
                          onClick={() => setExpenseViewTab("purpose")}
                          className={cn(
                            "px-2 py-0.5 font-bold rounded transition-all cursor-pointer",
                            expenseViewTab === "purpose" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                          )}
                        >
                          By Purpose ({categories.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpenseViewTab("mode")}
                          className={cn(
                            "px-2 py-0.5 font-bold rounded transition-all cursor-pointer",
                            expenseViewTab === "mode" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                          )}
                        >
                          By Mode ({modes.length || 4})
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-semibold">Exp/Sales:</span>
                        <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200/60">
                          {ratio}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-2 items-center">
                      {/* Compact Donut */}
                      <div className="col-span-4 flex items-center justify-center relative">
                        <div className="w-[95px] h-[95px] relative flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={expTotal > 0 ? (expenseViewTab === "purpose" ? categories : modes) : [{ name: "Zero", amount: 1 }]}
                                cx="50%"
                                cy="50%"
                                innerRadius={28}
                                outerRadius={44}
                                paddingAngle={3}
                                dataKey="amount"
                              >
                                {expTotal > 0 ? (
                                  (expenseViewTab === "purpose" ? categories : modes).map((entry: any, i: number) => {
                                    const pieColors = expenseViewTab === "purpose"
                                      ? ["#F43F5E", "#F59E0B", "#3F63AD", "#10B981", "#8B5CF6", "#06B6D4", "#EC4899"]
                                      : ["#10B981", "#8B5CF6", "#3F63AD", "#06B6D4", "#F59E0B"];
                                    return (
                                      <Cell 
                                        key={i} 
                                        fill={pieColors[i % pieColors.length]} 
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => {
                                          if (expenseViewTab === "purpose") {
                                            setExpenseModalModeFilter("all");
                                            setSearchQuery(entry.category);
                                          } else {
                                            setExpenseModalModeFilter(entry.mode);
                                          }
                                          setActiveModal("expenses");
                                        }}
                                      />
                                    );
                                  })
                                ) : (
                                  <Cell fill="#E2E8F0" />
                                )}
                              </Pie>
                              <Tooltip
                                formatter={(v: any) => [`${indianNumberFormat(expTotal > 0 ? Number(v) : 0)}`, "Amount"]}
                                position={{ x: 0, y: -10 }}
                                wrapperStyle={{ zIndex: 20 }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[7px] font-black text-slate-400 uppercase">EXP</span>
                            <span className="text-[11px] font-black text-rose-600 font-mono">
                              {indianNumberFormat(expTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Top 2 Items */}
                      <div className="col-span-8 space-y-1.5">
                        {(expenseViewTab === "purpose" ? displayCategories.slice(0, 2) : displayModes.slice(0, 2)).map((item: any, i: number) => {
                          const name = item.category || item.mode;
                          const colors = ["#F43F5E", "#F59E0B", "#3F63AD", "#10B981"];
                          const color = colors[i % colors.length];
                          return (
                            <div
                              key={name}
                              onClick={() => {
                                if (expenseViewTab === "purpose") {
                                  setSearchQuery(name);
                                } else {
                                  setExpenseModalModeFilter(name);
                                }
                                setActiveModal("expenses");
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200/60 cursor-pointer transition-all text-xs"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                  <span className="font-bold text-slate-800 truncate">{name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[9px] font-mono font-bold px-1 bg-slate-100 text-slate-600 rounded">
                                    {item.percentage || 0}%
                                  </span>
                                  <span className="font-black text-slate-900 font-mono text-[11px]">
                                    {formatCurrency(item.amount || 0)}
                                  </span>
                                </div>
                              </div>
                              <Progress 
                                value={item.percentage || 0} 
                                className="h-1 mt-1 bg-slate-100" 
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* C. COMPACT RECENT VOUCHER TICKER (1 LINE) */}
                  {recentVouchers.length > 0 && (
                    <div 
                      onClick={() => { setExpenseModalModeFilter("all"); setActiveModal("expenses"); }}
                      className="p-1.5 rounded-lg bg-slate-50 border border-slate-200/60 flex items-center justify-between text-[11px] cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Latest:</span>
                        <span className={cn(
                          "px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase",
                          (recentVouchers[0]?.paymentMode || "").toLowerCase().includes("cash") ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          (recentVouchers[0]?.paymentMode || "").toLowerCase().includes("upi") ? "bg-purple-50 text-purple-700 border-purple-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {recentVouchers[0]?.paymentMode || "Cash"}
                        </span>
                        <span className="font-bold text-slate-800 truncate max-w-[150px]">
                          {recentVouchers[0]?.description || recentVouchers[0]?.category || "Expense"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="font-mono font-bold text-rose-600">
                          -{formatCurrency(recentVouchers[0]?.amount || 0)}
                        </span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 3. FOOTER */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Updated in real time</span>
              <span 
                onClick={() => { setExpenseModalModeFilter("all"); setActiveModal("expenses"); }}
                className="text-rose-600 font-bold cursor-pointer hover:underline flex items-center gap-1"
              >
                View all ledger <ArrowRight className="w-3 h-3" />
              </span>
            </div>
          </div>
          </div>

          {/* COLUMN 2: CATEGORY STOCK & WARRANTY OVERVIEW */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Category Stock & Warranty
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {stockBreakdown.warehouseFilterApplied === false && stockBreakdown.totalItemsCount
                      ? `All locations — no stock is tagged to "${stockBreakdown.warehouseRequested}"`
                      : "Live showroom inventory valuations & protection plans"}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => { setStockGroupFilter("all"); setStockCategoryFilter("all"); setOpenStockModal(true); }}
                className="text-xs font-bold text-[#3F63AD] hover:bg-blue-50 h-8 px-3"
              >
                All Categories →
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3">
              {/* ELECTRONICS STOCK — umbrella group (fridge, cooler, AC, TV, appliances…) */}
              <div
                onClick={() => { setStockGroupFilter("electronics"); setStockCategoryFilter("all"); setOpenStockModal(true); }}
                className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-white hover:shadow-sm transition-all cursor-pointer flex flex-col justify-start"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Tv className="w-4 h-4 text-blue-600" /> Electronics
                  </span>
                  <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5">
                    {(stockBreakdown.electronics.quantity || 0).toLocaleString("en-IN")} Qty
                  </Badge>
                </div>
                <p className="text-lg font-black text-slate-900 font-mono my-1">
                  {formatCurrency(stockBreakdown.electronics.value)}
                </p>
                <span className="text-xs text-slate-400 font-medium block truncate">
                  {stockBreakdown.electronics.count || 0} Products
                  {electronicsSubCategories.length > 0 && ` • ${electronicsSubCategories.slice(0, 3).join(", ")}`}
                </span>
                {electronicsSubCategories.length > 0 && (
                  <span className="text-[10px] text-blue-600 font-bold mt-0.5">
                    {electronicsSubCategories.length} categories inside
                  </span>
                )}
              </div>

              {/* MOBILE STOCK */}
              <div
                onClick={() => { setStockGroupFilter("mobile"); setStockCategoryFilter("all"); setOpenStockModal(true); }}
                className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 hover:border-purple-500 hover:bg-white hover:shadow-sm transition-all cursor-pointer flex flex-col justify-start"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-purple-600" /> Mobile
                  </span>
                  <Badge className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.5">
                    {(stockBreakdown.mobile.quantity || 0).toLocaleString("en-IN")} Qty
                  </Badge>
                </div>
                <p className="text-lg font-black text-slate-900 font-mono my-1">
                  {formatCurrency(stockBreakdown.mobile.value)}
                </p>
                <span className="text-xs text-slate-400 font-medium block truncate">
                  {stockBreakdown.mobile.count || 0} Products
                  {mobileSubCategories.length > 0 && ` • ${mobileSubCategories.slice(0, 3).join(", ")}`}
                </span>
                {mobileSubCategories.length > 0 && (
                  <span className="text-[10px] text-purple-600 font-bold mt-0.5">
                    {mobileSubCategories.length} categories inside
                  </span>
                )}
              </div>

              {/* WARRANTY SALES */}
              <div
                onClick={() => router.push("/sales/invoices")}
                className="bg-slate-50/70 p-3 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-white hover:shadow-sm transition-all cursor-pointer flex flex-col justify-start"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> Warranty
                  </span>
                  <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5">
                    {warrantyData.totalCount || metrics.warrantyCount || 0} Sold
                  </Badge>
                </div>
                <p className="text-lg font-black text-emerald-700 font-mono my-1">
                  {formatCurrency(warrantyData.totalSales || metrics.warrantyRevenue || 0)}
                </p>
                <span className="text-xs text-emerald-700 font-bold">
                  {warrantyData.conversionRate || 0}% Conversion
                </span>
              </div>
            </div>

            {/* TOP STOCKED PRODUCTS — real item rows behind the category totals */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Top Stocked Products
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  {stockBreakdown.totalItemsCount || stockItems.length} items in catalog
                </span>
              </div>

              {stockItems.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl">
                  <Package className="w-6 h-6 text-slate-300 mb-1.5" />
                  <p className="text-xs font-bold text-slate-500">No stock items found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Add products in Item Master to see them here.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {[...stockItems]
                    .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
                    .slice(0, 3)
                    .map((it: any) => (
                      <div
                        key={it._id || it.code}
                        onClick={() => openProductLedger(it)}
                        title="Open product ledger"
                        className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-purple-200 transition-all cursor-pointer group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 truncate group-hover:text-purple-800">
                            {it.name}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                            <span className="font-semibold text-purple-700">{it.brand}</span>
                            <span>•</span>
                            <span>{it.category}</span>
                            <span
                              className={cn(
                                "px-1 rounded font-bold",
                                it.group === "mobile" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                              )}
                            >
                              {it.group === "mobile" ? "Mobile" : "Electronics"}
                            </span>
                            {it.vpCode && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{it.vpCode}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-slate-900 block">
                              {formatCurrency(it.stockValue || 0)}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-mono font-bold",
                                (it.availableQty || 0) > 0 ? "text-emerald-600" : "text-rose-600"
                              )}
                            >
                              {it.availableQty || 0} in stock
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openProductMaster(it); }}
                            title="Open in Item Master"
                            className="h-7 w-7 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#3F63AD] hover:border-[#3F63AD] flex items-center justify-center transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Catalog Valuation</span>
              <span className="font-bold text-slate-900 font-mono text-sm">₹{((stockBreakdown.totalStockValue || 0) / 10000000).toFixed(2)} Cr</span>
            </div>
          </div>

          {/* COLUMN 3: SALES STAFF LEADERBOARD + TOP SELLING PRODUCTS */}
          <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">
                    Sales Staff Leaderboard
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Top executive performance by billed sales revenue</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DateRangeFilter 
                  value={widgetFilters.staff} 
                  onChange={(val, start, end) => handleWidgetFilterChange('staff', val, start, end)}
                  className="w-[100px] h-8 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3">
              {staffPerformance.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-slate-400 text-xs font-medium">
                  No staff sales recorded for this period
                </div>
              ) : (
                staffPerformance.slice(0, 4).map((staff, idx) => {
                  const totalAmt = Number(staff.totalSales ?? staff.salesAmount) || 0;
                  const totalBills = Number(staff.totalInvoices ?? staff.numberOfBills) || 0;
                  const totalRecd = Number(staff.totalCollected ?? staff.collection) || 0;

                  return (
                    <div key={staff.staffName || idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-[#3F63AD] transition-all flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                            idx === 0 ? "bg-amber-100 text-amber-800 font-bold" : "bg-slate-200 text-slate-700"
                          )}>
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs sm:text-sm text-slate-800 truncate max-w-[100px]">{staff.staffName}</span>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono text-slate-600 px-1.5 py-0.5">
                          {totalBills} Bills
                        </Badge>
                      </div>
                      <p className="text-sm font-black text-[#3F63AD] font-mono my-0.5">
                        {formatCurrency(totalAmt)}
                      </p>
                      <span className="text-xs font-bold text-emerald-700 font-mono pt-1.5 border-t border-slate-200/60 block">
                        {formatCurrency(totalRecd)} collected
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Commission & target tracking</span>
              <span className="font-bold text-slate-700">Active Staff</span>
            </div>
          </div>

          {/* TOP SELLING PRODUCTS header — stacked in this same column, right above the two product cards below it. */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3F63AD] to-purple-600 flex items-center justify-center text-white shadow-xs">
                <Crown className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                  Top Selling Products
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200/60 px-1.5 py-0.2 rounded-md">
                    Fast Movers
                  </span>
                  {widgetLoading.products && (
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 border-t-[#3F63AD] animate-spin" />
                      Updating…
                    </span>
                  )}
                </h3>
              </div>
            </div>

            {/* DATE FILTER + COMPACT CATEGORY SWITCHER */}
            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                value={widgetFilters.products}
                onChange={(val, start, end) => handleWidgetFilterChange('products', val, start, end)}
                showIcon={true}
                className="w-[135px] h-8 text-xs font-semibold"
              />
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs">
              <button
                type="button"
                onClick={() => setTopSellingCategoryTab("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer",
                  topSellingCategoryTab === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTopSellingCategoryTab("mobiles")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1",
                  topSellingCategoryTab === "mobiles" ? "bg-purple-600 text-white shadow-xs" : "text-purple-700 hover:bg-purple-50"
                )}
              >
                <Smartphone className="w-3 h-3" /> Mobiles
              </button>
              <button
                type="button"
                onClick={() => setTopSellingCategoryTab("electronics")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1",
                  topSellingCategoryTab === "electronics" ? "bg-[#3F63AD] text-white shadow-xs" : "text-[#3F63AD] hover:bg-blue-50"
                )}
              >
                <Tv className="w-3 h-3" /> Electronics
                </button>
              </div>
            </div>
          </div>

            {/* 📱 CARD 1: TOP SELLING MOBILES (COMPACT) */}
            {(topSellingCategoryTab === "all" || topSellingCategoryTab === "mobiles") && (() => {
              const mobilesList: any[] = (widgetData.products?.topMobiles ?? data?.topMobiles ?? []).slice(0, 4);

              const totalMobileRev = mobilesList.reduce((sum, m) => sum + (m.revenue || 0), 0);
              const totalMobileUnits = mobilesList.reduce((sum, m) => sum + (m.sales || 0), 0);

              return (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-600 flex-shrink-0">
                          <Smartphone className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                            Top Mobiles
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              {totalMobileUnits} Units
                            </span>
                          </h4>
                        </div>
                      </div>
                      <span className="font-mono font-black text-xs text-purple-700">{formatCurrency(totalMobileRev)}</span>
                    </div>

                    {/* COMPACT LIST */}
                    <div className="space-y-1.5 py-2.5">
                      {mobilesList.length === 0 && (
                        <div className="py-8 flex flex-col items-center justify-center text-center">
                          <Smartphone className="w-7 h-7 text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-500">No mobiles sold in this period</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Try a wider date range from the filter above.</p>
                        </div>
                      )}
                      {mobilesList.map((m: any, idx: number) => {
                        const share = totalMobileRev > 0 ? Math.round((m.revenue / totalMobileRev) * 100) : 0;
                        const rankColors = [
                          "bg-amber-400 text-slate-950 font-black",
                          "bg-slate-300 text-slate-900 font-bold",
                          "bg-amber-700 text-white font-bold",
                          "bg-slate-100 text-slate-600 font-bold",
                        ];

                        return (
                          <div 
                            key={m.name || idx}
                            onClick={() => router.push(`/masters/items?search=${encodeURIComponent(m.brand || m.name)}`)}
                            className="p-2 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-purple-50/40 hover:border-purple-200 transition-all cursor-pointer group text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("w-4.5 h-4.5 rounded text-[10px] flex items-center justify-center flex-shrink-0", rankColors[idx] || "bg-slate-100 text-slate-600")}>
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate group-hover:text-purple-900">
                                    {m.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.2">
                                    <span className="font-semibold text-purple-700">{m.brand}</span>
                                    <span>•</span>
                                    <span>{m.sales} Sold</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 font-bold">+{m.growth || 18}%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="font-mono font-bold text-xs text-slate-900 block">
                                  {formatCurrency(m.revenue)}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 block">
                                  {indianNumberFormat(m.avgPrice)}/u
                                </span>
                              </div>
                            </div>

                            <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden mt-1.5">
                              <div 
                                className="bg-purple-600 h-full rounded-full transition-all" 
                                style={{ width: `${share}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ranked by revenue</span>
                    <span 
                      onClick={() => router.push("/masters/items?category=Mobile")}
                      className="text-purple-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[11px]"
                    >
                      All Mobiles <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 📺 CARD 2: TOP SELLING ELECTRONICS (COMPACT) */}
            {(topSellingCategoryTab === "all" || topSellingCategoryTab === "electronics") && (() => {
              const electronicsList: any[] = (widgetData.products?.topElectronics ?? data?.topElectronics ?? []).slice(0, 4);

              const totalElecRev = electronicsList.reduce((sum, e) => sum + (e.revenue || 0), 0);
              const totalElecUnits = electronicsList.reduce((sum, e) => sum + (e.sales || 0), 0);

              return (
                <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#3F63AD] flex-shrink-0">
                          <Tv className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                            Top Electronics
                            <span className="text-[10px] font-bold text-[#3F63AD] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              {totalElecUnits} Units
                            </span>
                          </h4>
                        </div>
                      </div>
                      <span className="font-mono font-black text-xs text-[#3F63AD]">{formatCurrency(totalElecRev)}</span>
                    </div>

                    {/* COMPACT LIST */}
                    <div className="space-y-1.5 py-2.5">
                      {electronicsList.length === 0 && (
                        <div className="py-8 flex flex-col items-center justify-center text-center">
                          <Tv className="w-7 h-7 text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-500">No electronics sold in this period</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Try a wider date range from the filter above.</p>
                        </div>
                      )}
                      {electronicsList.map((e: any, idx: number) => {
                        const share = totalElecRev > 0 ? Math.round((e.revenue / totalElecRev) * 100) : 0;
                        const rankColors = [
                          "bg-amber-400 text-slate-950 font-black",
                          "bg-slate-300 text-slate-900 font-bold",
                          "bg-amber-700 text-white font-bold",
                          "bg-slate-100 text-slate-600 font-bold",
                        ];

                        return (
                          <div 
                            key={e.name || idx}
                            onClick={() => router.push(`/masters/items?search=${encodeURIComponent(e.brand || e.name)}`)}
                            className="p-2 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-blue-50/40 hover:border-blue-200 transition-all cursor-pointer group text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={cn("w-4.5 h-4.5 rounded text-[10px] flex items-center justify-center flex-shrink-0", rankColors[idx] || "bg-slate-100 text-slate-600")}>
                                  #{idx + 1}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate group-hover:text-[#3F63AD]">
                                    {e.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.2">
                                    <span className="font-semibold text-[#3F63AD]">{e.brand}</span>
                                    <span>•</span>
                                    <span>{e.sales} Sold</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 font-bold">+{e.growth || 16}%</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="font-mono font-bold text-xs text-slate-900 block">
                                  {formatCurrency(e.revenue)}
                                </span>
                                <span className="text-[9px] font-mono text-slate-400 block">
                                  {indianNumberFormat(e.avgPrice)}/u
                                </span>
                              </div>
                            </div>

                            <div className="w-full bg-slate-200/60 h-1 rounded-full overflow-hidden mt-1.5">
                              <div 
                                className="bg-[#3F63AD] h-full rounded-full transition-all" 
                                style={{ width: `${share}%` }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Ranked by revenue</span>
                    <span 
                      onClick={() => router.push("/masters/items?category=Electronics")}
                      className="text-[#3F63AD] font-bold hover:underline cursor-pointer flex items-center gap-0.5 text-[11px]"
                    >
                      All Electronics <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════════
            📋 POOL C: DETAILED PAYMENT LOG + RECENT INVOICES + TASK DELEGATION + LEAD
            PIPELINE — manually balanced: [PaymentLog+RecentInvoices] | [TaskDelegation]
            | [LeadPipeline].
        ═══════════════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {/* COLUMN 1: DETAILED PAYMENT LOG + RECENT INVOICES & BILLS */}
          <div className="flex flex-col gap-3">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Detailed Payment Log</h3>
                  <p className="text-xs text-slate-500 font-medium">Real-time live stream of all received transactions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DateRangeFilter 
                  value={widgetFilters.logs} 
                  onChange={(val, start, end) => handleWidgetFilterChange('logs', val, start, end)}
                  className="w-[110px] h-8 text-xs font-semibold"
                />
                <Button size="sm" variant="outline" className="text-xs h-8 px-2.5 font-bold" onClick={() => router.push(`/dashboard/reports?type=all&dateFilter=${widgetFilters.logs}`)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> All
                </Button>
              </div>
            </div>

            <div className="p-0 max-h-[310px] overflow-y-auto my-2.5">
              <table className="w-full text-xs sm:text-sm text-left table-fixed">
                <thead className="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-2.5 py-2.5 w-[22%]">Time</th>
                    <th className="px-2.5 py-2.5 w-[28%]">Invoice #</th>
                    <th className="px-2.5 py-2.5 w-[20%] text-center">Mode</th>
                    <th className="px-2.5 py-2.5 w-[20%] text-right">Amount</th>
                    <th className="px-1.5 py-2.5 w-[10%] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const txns = widgetData.logs?.transactions || { cash: [], upi: [], online: [], card: [], finance: [] };
                    const combined = [
                      ...(txns.cash || []), 
                      ...(txns.upi || []), 
                      ...(txns.online || []), 
                      ...(txns.card || []), 
                      ...(txns.finance || [])
                    ]
                      .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
                      .slice(0, 5);

                    if (combined.length === 0) {
                      return (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-slate-400 text-xs font-medium">
                            No payment transactions recorded for this period
                          </td>
                        </tr>
                      );
                    }

                    return combined.map((txn: any, i) => {
                      const timeMatch = (txn.time || "").match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i);
                      const displayTime = timeMatch ? timeMatch[1] : (txn.time || "Today");

                      return (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-2.5 py-2.5 text-left font-medium text-slate-600 text-xs">
                            {displayTime}
                          </td>
                          <td className="px-2.5 py-2.5 text-left font-mono font-bold text-slate-800 text-xs truncate">
                            <span className="cursor-pointer hover:text-[#3F63AD]" onClick={() => handlePrintTrigger(txn)}>
                              {txn.id}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                              {txn.mode?.split(" ")[0] || "Cash"}
                            </span>
                          </td>
                          <td className="px-2.5 py-2.5 text-right font-black text-slate-900 font-mono text-xs sm:text-sm">
                            {formatCurrency(txn.amount)}
                          </td>
                          <td className="px-1.5 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-slate-400 hover:text-[#3F63AD]" 
                                onClick={() => handlePrintTrigger(txn)}
                                title="Print Invoice"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-slate-400 hover:text-emerald-600" 
                                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Dear ${txn.customer}, your payment of ${formatCurrency(txn.amount)} has been received. Invoice: ${txn.id}. Thank you!`)}`, '_blank')}
                                title="WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Live MongoDB Receipts</span>
              <span className="font-bold text-slate-700">Real-time sync</span>
            </div>
          </div>

          {/* CARD 2 (RIGHT): TODAY'S SALES REPORT / RECENT INVOICES */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-[#3F63AD]">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 tracking-tight">Recent Invoices & Bills</h3>
                  <p className="text-xs text-slate-500 font-medium">1-click official GST tax invoice print and status overview</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DateRangeFilter 
                  value={widgetFilters.recent} 
                  onChange={(val, start, end) => handleWidgetFilterChange('recent', val, start, end)}
                  className="w-[110px] h-8 text-xs font-semibold"
                />
                <Button 
                  size="sm" 
                  onClick={handleOpenInvoiceModal} 
                  className="bg-[#76C043] hover:bg-[#60a82c] text-white border-none text-xs h-8 px-3 rounded-lg font-bold"
                >
                  + New Bill
                </Button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[310px] overflow-y-auto my-2.5">
              {(widgetData.recent?.recentInvoices || []).slice(0, 5).map((inv: any) => (
                <div
                  key={inv._id || inv.invoiceNumber}
                  onClick={() => handlePrintTrigger(inv)}
                  className="flex items-center justify-between p-2.5 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-[#3F63AD]/10 flex items-center justify-center text-[#3F63AD] group-hover:bg-[#3F63AD] group-hover:text-white transition-colors">
                      <Printer className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#3F63AD] transition-colors">{inv.invoiceNumber}</p>
                        {(inv.reprintCount || 0) > 0 && (
                          <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
                            🖨️ {inv.reprintCount}x
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[150px]">{inv.customerName} · {inv.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs sm:text-sm font-black text-slate-900 font-mono">{formatCurrency(inv.total)}</p>
                      <p className="text-[10px] text-slate-400 font-semibold">{inv.paymentMode || "Cash"}</p>
                    </div>
                    <StatusBadge status={inv.status} />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintTrigger(inv);
                      }}
                      className="h-7 px-2.5 text-xs font-bold border-[#3F63AD] text-[#3F63AD] hover:bg-[#3F63AD] hover:text-white"
                    >
                      Print
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Official GST Invoices</span>
              <span className="font-bold text-slate-700">Value Plus Format</span>
            </div>
          </div>
          </div>

          {/* COLUMN 2: ADMIN & STAFF TASK DELEGATION */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-700">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Task Delegation & Operations
                      <Badge className="bg-purple-50 text-purple-800 border-purple-200 text-xs font-bold px-2 py-0.5">
                        {tasks.filter(t => t.status !== "Completed").length} Active
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Admin self-tasks & sales executive team assignments</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setIsNewTaskModalOpen(true)}
                    className="bg-[#30539C] hover:bg-[#1E3A8A] text-white border-none text-xs h-8 px-3 rounded-lg font-bold shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Assign Task
                  </Button>
                </div>
              </div>

              {/* QUICK FILTER TABS */}
              <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto border-b border-slate-100">
                {[
                  { key: "all", label: `All (${tasks.length})` },
                  { key: "admin", label: `👑 Admin / Self (${tasks.filter(t => t.assignedStaff?.includes("Admin") || t.assignedStaff?.includes("Self")).length})` },
                  { key: "staff", label: `👥 Staff (${tasks.filter(t => !t.assignedStaff?.includes("Admin") && !t.assignedStaff?.includes("Self")).length})` },
                  { key: "pending", label: `⏳ Pending (${tasks.filter(t => t.status !== "Completed").length})` },
                  { key: "completed", label: `✅ Done (${tasks.filter(t => t.status === "Completed").length})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setTaskTabFilter(tab.key as any)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                      taskTabFilter === tab.key
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* TASK LIST */}
              <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto my-2 space-y-1">
                {(() => {
                  const filtered = tasks.filter(t => {
                    if (taskTabFilter === "admin") return t.assignedStaff?.includes("Admin") || t.assignedStaff?.includes("Self");
                    if (taskTabFilter === "staff") return !t.assignedStaff?.includes("Admin") && !t.assignedStaff?.includes("Self");
                    if (taskTabFilter === "pending") return t.status !== "Completed";
                    if (taskTabFilter === "completed") return t.status === "Completed";
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">
                        No tasks found for this filter.
                      </div>
                    );
                  }

                  return filtered.map((task: any) => {
                    const isDone = task.status === "Completed";
                    const isAdmin = task.assignedStaff?.includes("Admin") || task.assignedStaff?.includes("Self");

                    return (
                      <div
                        key={task._id}
                        className={cn(
                          "flex items-start justify-between p-2.5 rounded-xl border transition-all",
                          isDone 
                            ? "bg-slate-50/70 border-slate-200/60 opacity-70" 
                            : "bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs"
                        )}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <button
                            onClick={() => handleToggleTaskStatus(task)}
                            className={cn(
                              "w-5 h-5 rounded-md flex items-center justify-center mt-0.5 flex-shrink-0 transition-colors border",
                              isDone
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "border-slate-300 hover:border-slate-400 bg-white"
                            )}
                            title={isDone ? "Mark Pending" : "Mark Completed"}
                          >
                            {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className={cn("text-xs font-bold text-slate-900 truncate", isDone && "line-through text-slate-400")}>
                                {task.taskTitle}
                              </p>
                              
                              {/* Assigned Badge */}
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] font-bold font-mono inline-flex items-center gap-1 border",
                                isAdmin 
                                  ? "bg-purple-50 text-purple-800 border-purple-200" 
                                  : "bg-blue-50 text-blue-800 border-blue-200"
                              )}>
                                {isAdmin ? "👑 Admin (Self)" : `👤 ${task.assignedStaff}`}
                              </span>

                              {/* Priority Badge */}
                              <span className={cn(
                                "px-1.5 py-0.2 rounded text-[9px] font-bold uppercase",
                                task.priority === "Urgent" && "bg-rose-100 text-rose-800",
                                task.priority === "High" && "bg-orange-100 text-orange-800",
                                task.priority === "Medium" && "bg-blue-100 text-blue-800",
                                task.priority === "Low" && "bg-slate-100 text-slate-700",
                              )}>
                                {task.priority || "Medium"}
                              </span>
                            </div>

                            {task.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{task.description}</p>
                            )}

                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" /> {task.dueDate} {task.dueTime ? `· ${task.dueTime}` : ""}
                              </span>
                              <span className={cn(
                                "font-bold",
                                task.status === "Completed" ? "text-emerald-700" : task.status === "In Progress" ? "text-blue-700" : "text-amber-700"
                              )}>
                                ● {task.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteTask(task._id)}
                          className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>{tasks.filter(t => t.status === "Completed").length} of {tasks.length} tasks completed</span>
              <button 
                onClick={() => router.push("/staff/tasks")} 
                className="font-bold text-[#30539C] hover:underline flex items-center gap-1"
              >
                Manage in Staff Hub <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* COLUMN 3: LEAD PIPELINE & CONVERSION FUNNEL */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 border-b border-slate-100 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                      Lead Pipeline & Conversion
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-bold px-2 py-0.5">
                        {leads.filter(l => l.status === "Converted").length} Converted
                      </Badge>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Enquiries, follow-up scheduler & counter conversion rate</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => setIsNewLeadModalOpen(true)}
                    className="bg-[#76C043] hover:bg-[#60a82c] text-white border-none text-xs h-8 px-3 rounded-lg font-bold shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> New Lead
                  </Button>
                </div>
              </div>

              {/* FUNNEL SUMMARY METRICS STRIP */}
              {(() => {
                const totalLeads = leads.length;
                const converted = leads.filter(l => l.status === "Converted").length;
                const followups = leads.filter(l => l.status === "Follow-up" || l.status === "Interested" || l.status === "Contacted").length;
                const convRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0;
                const pipelineVal = leads.reduce((acc, l) => acc + (Number(l.estimatedValue) || 0), 0);

                return (
                  <div className="grid grid-cols-4 gap-2 my-2.5">
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-bold text-blue-700 uppercase">Total Leads</p>
                      <p className="text-sm sm:text-sm font-black text-slate-900 font-mono">{totalLeads}</p>
                      <p className="text-[9px] text-slate-500 font-medium">{indianNumberFormat(pipelineVal)}</p>
                    </div>
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-bold text-amber-700 uppercase">Follow-ups</p>
                      <p className="text-sm sm:text-sm font-black text-amber-800 font-mono">{followups}</p>
                      <p className="text-[9px] text-amber-600 font-semibold">Active Action</p>
                    </div>
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase">Converted</p>
                      <p className="text-sm sm:text-sm font-black text-emerald-800 font-mono">{converted}</p>
                      <p className="text-[9px] text-emerald-600 font-semibold">Won & Billed</p>
                    </div>
                    <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-2 text-center">
                      <p className="text-[10px] font-bold text-purple-700 uppercase">Conv. Rate</p>
                      <p className="text-sm sm:text-sm font-black text-purple-900 font-mono">{convRate}%</p>
                      <p className="text-[9px] text-purple-600 font-semibold">Funnel Win</p>
                    </div>
                  </div>
                );
              })()}

              {/* QUICK FILTER TABS */}
              <div className="flex items-center gap-1.5 py-1.5 overflow-x-auto border-b border-slate-100">
                {[
                  { key: "all", label: `All (${leads.length})` },
                  { key: "new", label: `🎯 New (${leads.filter(l => l.status === "New").length})` },
                  { key: "followup", label: `⏳ Follow-up (${leads.filter(l => l.status === "Follow-up" || l.status === "Interested" || l.status === "Contacted").length})` },
                  { key: "converted", label: `🏆 Converted (${leads.filter(l => l.status === "Converted").length})` },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setLeadTabFilter(tab.key as any)}
                    className={cn(
                      "px-2.5 py-0.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                      leadTabFilter === tab.key
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* LEADS STREAM */}
              <div className="divide-y divide-slate-100 max-h-[225px] overflow-y-auto my-1.5 space-y-1">
                {(() => {
                  const filtered = leads.filter(l => {
                    if (leadTabFilter === "new") return l.status === "New";
                    if (leadTabFilter === "followup") return l.status === "Follow-up" || l.status === "Interested" || l.status === "Contacted";
                    if (leadTabFilter === "converted") return l.status === "Converted";
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">
                        No leads found in this pipeline view.
                      </div>
                    );
                  }

                  return filtered.map((lead: any) => (
                    <div
                      key={lead._id}
                      className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 truncate">{lead.customerName}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{lead.mobile}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                          {lead.interestedProduct} {lead.estimatedValue > 0 && <span className="font-bold text-slate-900">· {indianNumberFormat(lead.estimatedValue)}</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Assigned: <span className="font-semibold text-slate-600">{lead.assignedStaff || "Sales Team"}</span> {lead.followUpDate ? `· Follow-up: ${lead.followUpDate}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <select
                          value={lead.status}
                          onChange={(e) => handleUpdateLeadStatus(lead._id, e.target.value)}
                          className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer transition-colors",
                            lead.status === "Converted" && "bg-emerald-50 text-emerald-800 border-emerald-200",
                            lead.status === "Follow-up" && "bg-amber-50 text-amber-800 border-amber-200",
                            lead.status === "New" && "bg-blue-50 text-blue-800 border-blue-200",
                            lead.status === "Interested" && "bg-purple-50 text-purple-800 border-purple-200",
                            lead.status === "Lost" && "bg-rose-50 text-rose-800 border-rose-200"
                          )}
                        >
                          <option value="New">New</option>
                          <option value="Follow-up">Follow-up</option>
                          <option value="Interested">Interested</option>
                          <option value="Converted">Converted</option>
                          <option value="Lost">Lost</option>
                        </select>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleLeadWhatsApp(lead)}
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          title="WhatsApp Message"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Customer Relationship Management</span>
              <button 
                onClick={() => router.push("/marketing/leads")} 
                className="font-bold text-[#30539C] hover:underline flex items-center gap-1"
              >
                Open Full CRM Leads <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── TODAY'S DUE COLLECTIONS & CREDIT KHATA SETTLEMENT WIDGET ─── */}
      {(() => {
        const todayStr = new Date().toISOString().split("T")[0];

        // Date-wise scope: when a range is chosen, keep only dues whose due date falls inside it
        const isDueFilterActive = Boolean(dueDateFilter && dueDateRange.start && dueDateRange.end);
        const scopedDues = isDueFilterActive
          ? dueInvoices.filter((inv: any) =>
              isDateInRange(inv.dueDate || inv.date, dueDateRange.start, dueDateRange.end)
            )
          : dueInvoices;

        // Dues with balance > 0
        const pendingDues = scopedDues.filter((inv: any) => (Number(inv.balanceAmount) > 0));
        
        // Today's Due: dueDate is today
        const todayDues = pendingDues.filter((inv: any) => {
          const dDate = inv.dueDate ? (inv.dueDate.includes("T") ? inv.dueDate.split("T")[0] : inv.dueDate) : "";
          return dDate === todayStr;
        });

        // Overdue: dueDate is before today
        const overdueDues = pendingDues.filter((inv: any) => {
          const dDate = inv.dueDate ? (inv.dueDate.includes("T") ? inv.dueDate.split("T")[0] : inv.dueDate) : "";
          return dDate && dDate < todayStr;
        });

        // Upcoming: dueDate is after today
        const upcomingDues = pendingDues.filter((inv: any) => {
          const dDate = inv.dueDate ? (inv.dueDate.includes("T") ? inv.dueDate.split("T")[0] : inv.dueDate) : "";
          return dDate && dDate > todayStr;
        });

        // Cleared dues: dueClearedAt exists or status === paid and balance === 0
        const clearedDues = scopedDues.filter((inv: any) => inv.dueClearedAt || (inv.paymentMode === "Due / Credit" && inv.status === "paid" && Number(inv.balanceAmount) === 0));

        // Total outstanding across every pending due in the selected date scope
        const totalPendingAmount = pendingDues.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);

        const todayDueAmount = todayDues.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);
        const overdueAmount = overdueDues.reduce((sum, inv) => sum + (Number(inv.balanceAmount) || 0), 0);
        const clearedTodayAmount = clearedDues
          .filter((inv: any) => {
            const clrDate = inv.dueClearedAt ? (typeof inv.dueClearedAt === 'string' && inv.dueClearedAt.includes('T') ? inv.dueClearedAt.split('T')[0] : inv.dueClearedAt) : "";
            return clrDate === todayStr;
          })
          .reduce((sum, inv) => sum + (Number(inv.total || inv.paidAmount) || 0), 0);

        let displayList: any[] = [];
        if (dueTabFilter === "today") displayList = todayDues;
        else if (dueTabFilter === "overdue") displayList = overdueDues;
        else if (dueTabFilter === "upcoming") displayList = upcomingDues;
        else if (dueTabFilter === "cleared") displayList = clearedDues;
        else displayList = pendingDues;

        return (
          <div className="bg-white rounded-xl border border-rose-100 shadow-sm p-4 space-y-3">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              {/* TITLE BLOCK */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Due Collections & Khata Settlement
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isDueFilterActive ? (
                      <>
                        Showing dues from{" "}
                        <span className="font-bold text-[#3F63AD]">{dueDateRange.start}</span> to{" "}
                        <span className="font-bold text-[#3F63AD]">{dueDateRange.end}</span>
                      </>
                    ) : (
                      <>Track customer promises, send reminders, and clear dues in real-time.</>
                    )}
                  </p>
                </div>
              </div>

              {/* CONTROLS + KPI STRIP */}
              <div className="flex flex-col sm:items-end gap-2.5 flex-shrink-0">
                {/* ROW 1: DATE FILTER + TOTAL PENDING BUTTON */}
                <div className="flex items-center gap-2">
                  <DateRangeFilter
                    value={dueDateFilter}
                    onChange={(val, start, end) => {
                      setDueDateFilter(val);
                      setDueDateRange({ start: start || "", end: end || "" });
                    }}
                    showIcon={true}
                    placeholder="All Dates"
                    className="w-[145px] !h-9 text-xs font-semibold rounded-xl"
                  />
                  {isDueFilterActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDateFilter("");
                        setDueDateRange({ start: "", end: "" });
                      }}
                      title="Clear date filter"
                      className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <Button
                    onClick={() => setDueTabFilter("all")}
                    title="Show every pending due in the selected date range"
                    className={cn(
                      "h-9 px-3.5 rounded-xl font-bold text-xs shadow-sm border transition-all gap-2",
                      dueTabFilter === "all"
                        ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200"
                    )}
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Total Pending</span>
                    <span className="font-mono font-black text-sm">{formatCurrency(totalPendingAmount)}</span>
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                      dueTabFilter === "all" ? "bg-white/25 text-white" : "bg-rose-200/70 text-rose-900"
                    )}>
                      {pendingDues.length}
                    </span>
                  </Button>
                </div>

                {/* ROW 2: UNIFIED KPI STRIP (equal cells, always one line) */}
                <div className="grid grid-cols-3 rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden divide-x divide-slate-200">
                  {[
                    { label: "Today's Due", amount: todayDueAmount, dot: "bg-rose-500", text: "text-rose-700" },
                    { label: "Overdue", amount: overdueAmount, dot: "bg-amber-500", text: "text-amber-700" },
                    { label: "Cleared Today", amount: clearedTodayAmount, dot: "bg-emerald-500", text: "text-emerald-700" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      title={`${kpi.label}: ${formatCurrency(kpi.amount)}`}
                      className="px-3.5 py-2 min-w-[110px]"
                    >
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                        <span className={cn("w-1.5 h-1.5 rounded-full", kpi.dot)} />
                        {kpi.label}
                      </p>
                      <p className={cn("text-sm font-black font-mono mt-0.5", kpi.text)}>
                        {indianNumberFormat(kpi.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { key: "today", label: "⏰ Today's Due", count: todayDues.length },
                { key: "overdue", label: "⚠️ Overdue", count: overdueDues.length },
                { key: "upcoming", label: "📅 Upcoming", count: upcomingDues.length },
                { key: "cleared", label: "✅ Cleared Dues", count: clearedDues.length },
                { key: "all", label: "📋 All Pending", count: pendingDues.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDueTabFilter(tab.key as any)}
                  className={cn(
                    "h-9 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 flex-shrink-0",
                    dueTabFilter === tab.key
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md",
                    dueTabFilter === tab.key ? "bg-white/25 text-white" : "bg-slate-200/80 text-slate-700"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Invoices List / Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Invoice & Customer</th>
                    <th className="p-3">Total Bill</th>
                    <th className="p-3">Advance Paid</th>
                    <th className="p-3">Remaining Due</th>
                    <th className="p-3">Promise / Due Date</th>
                    <th className="p-3">Status & Clearance</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 text-xs font-medium">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                        No dues matching the selected "{dueTabFilter}" filter.
                      </td>
                    </tr>
                  ) : (
                    displayList.map((inv: any) => {
                      const isCleared = Number(inv.balanceAmount) === 0 || inv.dueClearedAt;
                      const dDateStr = inv.dueDate ? (inv.dueDate.includes("T") ? inv.dueDate.split("T")[0] : inv.dueDate) : "";
                      const isTodayDue = dDateStr === todayStr;
                      const isOverdue = Boolean(dDateStr) && dDateStr < todayStr && !isCleared;
                      // Whole-day difference between the promised date and today, for
                      // "X days late" / "in N days" — not shown at all before, so an
                      // overdue due only ever said "Overdue" with no sense of how late.
                      const daysDiff = dDateStr
                        ? Math.round((new Date(dDateStr + "T00:00:00").getTime() - new Date(todayStr + "T00:00:00").getTime()) / 86400000)
                        : null;

                      return (
                        <tr key={inv._id || inv.invoiceNumber} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{inv.customerName || "Customer"}</span>
                              {inv.customerPhone && (
                                <span className="text-[10px] text-slate-500 font-mono">({inv.customerPhone})</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#3F63AD] font-mono font-bold">
                              #{inv.invoiceNumber} • {inv.date ? (typeof inv.date === 'string' && inv.date.includes('T') ? inv.date.split('T')[0] : inv.date) : "N/A"}
                            </div>
                            {inv.notes && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-xs">
                                Note: {inv.notes}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {formatCurrency(inv.total || inv.netAmount || 0)}
                          </td>
                          <td className="p-3 font-mono text-emerald-700 font-semibold">
                            {formatCurrency(inv.paidAmount || inv.dueAdvanceAmount || 0)}
                            <span className="block text-[9px] text-slate-400 font-normal">
                              via {inv.dueAdvanceMode || inv.paymentMode || "Cash"}
                            </span>
                          </td>
                          <td className="p-3">
                            {isCleared ? (
                              <span className="text-xs font-mono font-bold text-emerald-600">₹0.00 (PAID)</span>
                            ) : (
                              <span className="text-sm font-mono font-black text-rose-700">
                                {formatCurrency(inv.balanceAmount || 0)}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className={cn(
                              "font-mono text-xs font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded",
                              isTodayDue && "bg-rose-100 text-rose-800 border border-rose-200",
                              isOverdue && "bg-amber-100 text-amber-800 border border-amber-200",
                              !isTodayDue && !isOverdue && "text-slate-700 bg-slate-100"
                            )}>
                              <Calendar className="w-3 h-3" />
                              {dDateStr || "Immediate"}
                            </div>
                            {isTodayDue && <span className="block text-[9px] font-bold text-rose-600 mt-0.5">⚠️ Due Today!</span>}
                            {isOverdue && daysDiff !== null && (
                              <span className="block text-[9px] font-bold text-amber-600 mt-0.5">
                                🚨 {Math.abs(daysDiff)} day{Math.abs(daysDiff) === 1 ? "" : "s"} late
                              </span>
                            )}
                            {!isCleared && !isTodayDue && !isOverdue && daysDiff !== null && daysDiff > 0 && (
                              <span className="block text-[9px] font-bold text-slate-500 mt-0.5">
                                in {daysDiff} day{daysDiff === 1 ? "" : "s"}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {isCleared ? (
                              <div className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                <span className="font-bold">✅ Cleared</span>
                                <div className="text-[9px] text-slate-600">
                                  via {inv.dueClearedMode || "UPI"} {inv.dueClearedAt ? `on ${typeof inv.dueClearedAt === 'string' && inv.dueClearedAt.includes('T') ? inv.dueClearedAt.split('T')[0] : inv.dueClearedAt}` : ""}
                                </div>
                              </div>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                                Pending Settlement
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {!isCleared ? (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedDueInvoice(inv);
                                  setClearDuePaymentMode("Cash");
                                  setClearDueTxnId("");
                                  setClearDueStaff(inv.salesExecutive || "AMIT SINGH");
                                  setClearDueNotes(`Due settled for ${inv.customerName}`);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 shadow-sm rounded-lg"
                              >
                                <Check className="w-3.5 h-3.5 mr-1" /> Clear Due
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  router.push(`/invoice?id=${inv._id || inv.invoiceNumber}`);
                                }}
                                className="text-xs h-8 text-slate-600 border-slate-300"
                              >
                                <Printer className="w-3.5 h-3.5 mr-1" /> Invoice
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ─── PAYMENT LEAKAGE & VOID AUDIT DETAILS MODAL ────────────────── */}
      <Dialog open={!!leakageModal} onOpenChange={() => setLeakageModal(null)}>
        <DialogContent className="max-w-4xl p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1B2537] via-[#2C3E5A] to-[#1B2537] text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  <h3 className="text-xl font-black tracking-tight">{leakageModal?.title || "Audit Details"}</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {leakageModal?.description || "Detailed audit log for counter void & bill modification tracking."}
                </p>
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs px-3 py-1 font-bold">
                Security Audit
              </Badge>
            </div>
          </div>

          {/* Table */}
          <div className="p-5 bg-slate-50 max-h-[60vh] overflow-y-auto space-y-4">
            {(!leakageModal?.invoices || leakageModal.invoices.length === 0) ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                No void or leakage incidents found for this category in the selected period.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Date / Time</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3 text-right">Amount</th>
                      {showsAudit && <th className="p-3">Reason</th>}
                      {showsAudit && <th className="p-3">Authorised By</th>}
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {leakageModal.invoices.map((inv: any, idx: number) => (
                      <tr key={inv._id || inv.invoiceNumber || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber || inv.id}
                          {inv.docType && inv.docType !== "Invoice" && (
                            <p className="text-[9px] font-sans font-bold uppercase tracking-wider text-slate-400">
                              {inv.docType}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-slate-700">{inv.customerName || inv.customer || "Walk-in Guest"}</td>
                        <td className="p-3 text-slate-500 text-[11px]">{inv.date || "Today"}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {inv.paymentMode || "Cash"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-black text-slate-900">
                          {formatCurrency(inv.total || inv.amount || 0)}
                        </td>
                        {showsAudit && (
                          <td className="p-3 text-slate-700 max-w-[220px]">
                            {inv.auditReason ? (
                              <span className="text-[11px] leading-snug">{inv.auditReason}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        {showsAudit && (
                          <td className="p-3 text-[11px]">
                            {inv.auditBy ? (
                              <>
                                <p className="font-semibold text-slate-800">{inv.auditBy}</p>
                                {inv.auditAt && (
                                  <p className="text-slate-400">
                                    {new Date(inv.auditAt).toLocaleString("en-GB", {
                                      day: "2-digit", month: "short", year: "numeric",
                                      hour: "2-digit", minute: "2-digit",
                                    })}
                                  </p>
                                )}
                                {inv.usedLegacyPin && (
                                  <p className="text-amber-600 font-semibold">shared PIN</p>
                                )}
                              </>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 text-center">
                          <StatusBadge status={inv.status || "sent"} />
                        </td>
                        <td className="p-3 text-center">
                          {inv.isDeleted ? (
                            inv.snapshot ? (
                              <div className="flex flex-col items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActivePrintInvoice(inv.snapshot)}
                                  className="h-7 px-2 text-[10px] font-bold text-slate-600 border-slate-300 hover:bg-slate-100"
                                >
                                  <Eye className="w-3 h-3 mr-1" /> View Bill
                                </Button>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Archived Copy</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Archived
                              </span>
                            )
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setActivePrintInvoice(inv)}
                              className="h-7 px-2 text-[10px] font-bold text-[#3F63AD] border-[#3F63AD]/30 hover:bg-blue-50"
                            >
                              <Eye className="w-3 h-3 mr-1" /> View Bill
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Audit log secured by Value Plus ERP protocol
            </span>
            <div className="flex items-center gap-2">
              {leakageModal && leakageModal.invoices && leakageModal.invoices.length > 0 && (
                <ExportMenu
                  size="sm"
                  className="px-4 h-8 text-xs font-bold"
                  title={leakageModal.title || "Audit Log"}
                  subtitle={`${leakageModal.invoices.length} incident${leakageModal.invoices.length === 1 ? "" : "s"}`}
                  data={leakageModal.invoices.map((inv: any) => ({
                    "Invoice #": inv.invoiceNumber || inv.id || "",
                    Customer: inv.customerName || inv.customer || "Walk-in Guest",
                    "Date / Time": inv.date || "",
                    "Payment Mode": inv.paymentMode || "Cash",
                    Amount: inv.total || inv.amount || 0,
                    ...(showsAudit
                      ? {
                          Reason: inv.auditReason || "",
                          "Authorised By": inv.auditBy || "",
                          "Authorised At": inv.auditAt
                            ? new Date(inv.auditAt).toLocaleString("en-GB", {
                                day: "2-digit", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : "",
                        }
                      : {}),
                    Status: inv.status || "sent",
                  }))}
                  filename="leakage-audit-log"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLeakageModal(null)}
                className="px-5 font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── TRANSACTION & EXPENSE LEDGER DRILLDOWN MODAL ───────────────────────── */}
      <Dialog open={!!activeModal} onOpenChange={() => { setActiveModal(null); setExpenseModalModeFilter("all"); }}>
        <DialogContent className="max-w-4xl p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <div className={cn(
            "p-6 text-white",
            activeModal === "due" 
              ? "bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950" 
              : (activeModal === "expenses" || activeModal?.startsWith("expense"))
              ? "bg-gradient-to-r from-[#881337] via-[#4C0519] to-[#1E293B]"
              : "bg-gradient-to-r from-[#1B2537] via-[#2C3E5A] to-[#1B2537]"
          )}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {activeModal === "due" ? (
                    <Clock className="w-5 h-5 text-rose-400" />
                  ) : (activeModal === "expenses" || activeModal?.startsWith("expense")) ? (
                    <Receipt className="w-5 h-5 text-rose-400" />
                  ) : (
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                  )}
                  <h3 className="text-xl font-black tracking-tight uppercase">
                    {activeModal === "due" 
                      ? "Due / Credit Bills Ledger" 
                      : (activeModal === "expenses" || activeModal?.startsWith("expense"))
                      ? "Expense & Cash Withdrawal Ledger"
                      : `${activeModal} Payment Ledger`}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {activeModal === "due" 
                    ? "Itemized outstanding balance & pending due bills in selected period." 
                    : (activeModal === "expenses" || activeModal?.startsWith("expense"))
                    ? "Itemized showroom expenses, payment channels (Cash/UPI/Bank/Card) and purpose descriptions."
                    : `Itemized live receipts for ${activeModal} mode in selected period.`}
                </p>
              </div>
              <Badge className={cn(
                "text-xs px-3 py-1 font-bold",
                activeModal === "due"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : (activeModal === "expenses" || activeModal?.startsWith("expense"))
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              )}>
                {getFilteredTransactions().length} {activeModal === "due" ? "Due Bills" : (activeModal === "expenses" || activeModal?.startsWith("expense")) ? "Expense Vouchers" : "Transactions"}
              </Badge>
            </div>
          </div>

          <div className="p-5 bg-slate-50 max-h-[60vh] overflow-y-auto space-y-4">
            {/* SEARCH & MODE FILTER BAR */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={(activeModal === "expenses" || activeModal?.startsWith("expense")) 
                    ? "Search purpose description, category, payment mode, voucher #..." 
                    : "Search customer, invoice number..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-xs h-9"
                />
              </div>

              {(activeModal === "expenses" || activeModal?.startsWith("expense")) && (
                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 overflow-x-auto">
                  {["all", "Cash", "UPI", "Bank Transfer", "Card"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExpenseModalModeFilter(m)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-bold rounded-md transition-all whitespace-nowrap cursor-pointer",
                        expenseModalModeFilter === m
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {m === "all" ? "All Modes" : m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {getFilteredTransactions().length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-medium bg-white rounded-xl border border-slate-200">
                {activeModal === "due" 
                  ? "No due bills recorded for this period." 
                  : (activeModal === "expenses" || activeModal?.startsWith("expense"))
                  ? "No expense vouchers recorded matching the selected filter."
                  : "No transactions recorded for this payment mode."}
              </div>
            ) : (activeModal === "expenses" || activeModal?.startsWith("expense")) ? (
              /* EXPENSE SPECIFIC DRILLDOWN TABLE */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Voucher #</th>
                      <th className="p-3">Purpose & Description</th>
                      <th className="p-3">Payment Mode</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {getFilteredTransactions().map((exp: any, idx: number) => {
                      const mode = exp.paymentMode || "Cash";
                      const isCash = mode.toLowerCase().includes("cash");
                      const isUPI = mode.toLowerCase().includes("upi");
                      const isBank = mode.toLowerCase().includes("bank") || mode.toLowerCase().includes("transfer") || mode.toLowerCase().includes("neft");
                      const isCard = mode.toLowerCase().includes("card");

                      return (
                        <tr key={exp.expenseNo || exp._id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {exp.expenseNo || `EXP-${idx + 1}`}
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">
                                  {exp.description || exp.category || "Showroom Expense"}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-500 px-1.5 py-0.2 bg-slate-100 rounded border border-slate-200">
                                  {exp.category || "General"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                              isCash ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              isUPI ? "bg-purple-50 text-purple-700 border-purple-200" :
                              isBank ? "bg-blue-50 text-blue-700 border-blue-200" :
                              isCard ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                              "bg-slate-100 text-slate-700 border-slate-200"
                            )}>
                              {isCash && <Wallet className="w-2.5 h-2.5" />}
                              {isUPI && <Zap className="w-2.5 h-2.5" />}
                              {isBank && <Building2 className="w-2.5 h-2.5" />}
                              {isCard && <CreditCard className="w-2.5 h-2.5" />}
                              {mode}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 text-[11px]">
                            {formatDateShort(exp.date || exp.createdAt)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-rose-600">
                            {formatCurrency(exp.amount || 0)}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/purchase/expenses?dateFilter=${widgetFilters.expenses}`)}
                              className="h-7 px-2 text-[10px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" /> Open Hub
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* SALES & BILLS TRANSACTION TABLE */
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3">Invoice #</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Time / Date</th>
                      <th className="p-3">Payment Mode</th>
                      {activeModal === "due" ? (
                        <>
                          <th className="p-3 text-right">Total Bill</th>
                          <th className="p-3 text-right text-rose-600">Pending Due</th>
                        </>
                      ) : (
                        <th className="p-3 text-right">Amount</th>
                      )}
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {getFilteredTransactions().map((txn: any, idx: number) => {
                      const dueAmt = Number(txn.dueAmount) || Number(txn.balanceAmount) || (Number(txn.amount || txn.total || 0) - Number(txn.paidAmount || 0));
                      return (
                        <tr key={txn.id || txn.invoiceNumber || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-bold text-slate-900">
                            {txn.id || txn.invoiceNumber}
                          </td>
                          <td className="p-3 text-slate-700">{txn.customer || txn.customerName || "Walk-in Guest"}</td>
                          <td className="p-3 text-slate-500 text-[11px]">{txn.time || txn.date || "Today"}</td>
                          <td className="p-3">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              activeModal === "due" ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-slate-100 text-slate-700"
                            )}>
                              {txn.mode || activeModal}
                            </span>
                          </td>
                          {activeModal === "due" ? (
                            <>
                              <td className="p-3 text-right font-mono font-bold text-slate-700">
                                {formatCurrency(txn.amount || txn.total || 0)}
                              </td>
                              <td className="p-3 text-right font-mono font-black text-rose-600">
                                {formatCurrency(dueAmt > 0 ? dueAmt : (txn.amount || txn.total || 0))}
                              </td>
                            </>
                          ) : (
                            <td className="p-3 text-right font-mono font-black text-slate-900">
                              {formatCurrency(txn.amount || txn.total || 0)}
                            </td>
                          )}
                          <td className="p-3 text-center">
                            {txn.isReceipt ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push("/sales/payments")}
                                className="h-7 px-2 text-[10px] font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              >
                                <Receipt className="w-3 h-3 mr-1 text-emerald-600" /> Payment Hub
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintTrigger(txn)}
                                className="h-7 px-2 text-[10px] font-bold text-[#3F63AD] border-[#3F63AD]/30 hover:bg-blue-50"
                              >
                                <Printer className="w-3 h-3 mr-1" /> View Bill
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">
              Total Filtered: {formatCurrency(getFilteredTransactions().reduce((s: number, t: any) => s + (t.amount || t.total || 0), 0))}
            </span>
            <div className="flex items-center gap-2">
              {(activeModal === "expenses" || activeModal?.startsWith("expense")) && (
                <Button
                  size="sm"
                  onClick={() => router.push("/purchase/expenses")}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-8 px-3 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Record New Expense
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setActiveModal(null); setExpenseModalModeFilter("all"); }}
                className="px-5 font-bold"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── OFFICIAL INVOICE PRINT & PREVIEW MODAL ────────────────────── */}
      <Dialog open={!!activePrintInvoice} onOpenChange={() => setActivePrintInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-2">
          <ValueplusInvoice invoiceData={activePrintInvoice} />
        </DialogContent>
      </Dialog>

      {/* ─── 1. NEW SALES INVOICE (BILLING COUNTER) MODAL ──────────────── */}
      <InvoiceCreationModal 
        isOpen={openInvoiceModal} 
        onClose={() => setOpenInvoiceModal(false)}
        onSuccess={() => {
          setOpenInvoiceModal(false);
          refreshAllDashboard();
        }}
      />

      {/* ─── 2. NEW ESTIMATE MODAL FORM ─────────────────────────────── */}
      <Dialog open={openEstimateModal} onOpenChange={setOpenEstimateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" /> Create New Estimate / Quotation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Generate a sales quotation for client approval.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateEstimate} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold">Customer Name *</Label>
              <Input
                required
                placeholder="e.g. Tata Consultancy Services"
                value={estimateForm.customerName}
                onChange={(e) => setEstimateForm({ ...estimateForm, customerName: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Estimated Total Value (₹) *</Label>
              <Input
                required
                type="number"
                placeholder="e.g. 250000"
                value={estimateForm.total}
                onChange={(e) => setEstimateForm({ ...estimateForm, total: e.target.value })}
                className="h-9 text-xs mt-1 font-bold"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Terms & Notes</Label>
              <Input
                placeholder="Valid for 15 days from issue"
                value={estimateForm.notes}
                onChange={(e) => setEstimateForm({ ...estimateForm, notes: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenEstimateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                {submitting ? "Saving..." : "Save Estimate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── 3. ADD CUSTOMER MODAL FORM ─────────────────────────────── */}
      <Dialog open={openCustomerModal} onOpenChange={setOpenCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" /> Add New Customer
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new buyer to your customer directory and khata.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddCustomer} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold">Customer Name *</Label>
              <Input
                required
                placeholder="e.g. Ramesh Kumar / Apex Enterprises"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Customer Mobile Number *</Label>
                <Input
                  required
                  placeholder="+91 98200 12345"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Email Address</Label>
                <Input
                  type="email"
                  placeholder="contact@apex.com"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">GSTIN Number</Label>
                <Input
                  placeholder="27AAACA1234A1Z5"
                  value={customerForm.gstNumber}
                  onChange={(e) => setCustomerForm({ ...customerForm, gstNumber: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Credit Limit (₹)</Label>
                <Input
                  type="number"
                  placeholder="50000"
                  value={customerForm.creditLimit}
                  onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenCustomerModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {submitting ? "Saving..." : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── 4. ADD ITEM MODAL FORM ─────────────────────────────────── */}
      <Dialog open={openItemModal} onOpenChange={setOpenItemModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" /> Add New Inventory Item
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add a new product item into stock inventory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold">Item Name *</Label>
              <Input
                required
                placeholder="e.g. Wireless Gaming Mouse"
                value={itemForm.name}
                onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">HSN Code</Label>
                <Input
                  placeholder="8471"
                  value={itemForm.hsnCode}
                  onChange={(e) => setItemForm({ ...itemForm, hsnCode: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">GST Rate (%)</Label>
                <select
                  value={itemForm.gstRate}
                  onChange={(e) => setItemForm({ ...itemForm, gstRate: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs mt-1"
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Purchase Price (₹)</Label>
                <Input
                  type="number"
                  placeholder="1200"
                  value={itemForm.purchasePrice}
                  onChange={(e) => setItemForm({ ...itemForm, purchasePrice: e.target.value })}
                  className="h-9 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Selling Price (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="1800"
                  value={itemForm.sellingPrice}
                  onChange={(e) => setItemForm({ ...itemForm, sellingPrice: e.target.value })}
                  className="h-9 text-xs mt-1 font-bold"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Opening Stock Quantity</Label>
              <Input
                type="number"
                placeholder="25"
                value={itemForm.openingStock}
                onChange={(e) => setItemForm({ ...itemForm, openingStock: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenItemModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {submitting ? "Saving..." : "Save Product Item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── 5. RECORD PAYMENT MODAL FORM ───────────────────────────── */}
      <Dialog open={openPaymentModal} onOpenChange={setOpenPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-[#76C043]" /> Record Payment Receipt
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Record a payment collection from a customer or cash counter.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecordPayment} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs font-semibold">Customer Name *</Label>
              <Input
                required
                placeholder="e.g. Ramesh Kumar / Reliance Retail"
                value={paymentForm.partyName}
                onChange={(e) => setPaymentForm({ ...paymentForm, partyName: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Amount Received (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="50000"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="h-9 text-xs mt-1 font-bold text-emerald-600"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs mt-1"
                >
                  <option value="Cash Counter">Cash Counter</option>
                  <option value="UPI / PhonePe">UPI / PhonePe / GPay</option>
                  <option value="Bank Transfer">HDFC Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Reference Notes</Label>
              <Input
                placeholder="e.g. Received via UPI Ref #9823"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                className="h-9 text-xs mt-1"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpenPaymentModal(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting} className="bg-[#76C043] hover:bg-emerald-600 text-slate-950 font-bold">
                {submitting ? "Saving..." : "Record Payment Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── TOTAL STOCK CATEGORY BREAKDOWN MODAL ───────────────────────── */}
      <Dialog open={openStockModal} onOpenChange={setOpenStockModal}>
        <DialogContent className="max-w-4xl p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1B2537] via-[#2C3E5A] to-[#1B2537] text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl font-black tracking-tight">Total Stock & Category Directory</h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Click any category below to view and filter live stock items in your inventory catalog.
                </p>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1 font-bold">
                Live Inventory
              </Badge>
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Total Available Units</p>
                <p className="text-2xl font-black text-white mt-0.5">
                  {stockBreakdown.totalQuantity.toLocaleString("en-IN")} <span className="text-xs font-normal text-slate-300">Units</span>
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Total Stock Valuation</p>
                <p className="text-2xl font-black text-emerald-300 mt-0.5">
                  {formatCurrency(stockBreakdown.totalStockValue)}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Active Categories</p>
                <p className="text-2xl font-black text-amber-300 mt-0.5">
                  {(stockBreakdown.categories || []).length} <span className="text-xs font-normal text-slate-300">Groups</span>
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 bg-slate-50 max-h-[60vh] overflow-y-auto space-y-4">
            {/* Search Filter */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search products or categories (e.g. LED, AC, iPhone, Samsung)..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="pl-9 bg-white border-slate-200 text-xs h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpenStockModal(false);
                  router.push("/masters/items");
                }}
                className="text-xs font-bold text-[#3F63AD] border-[#3F63AD]/30 hover:bg-blue-50 whitespace-nowrap h-9"
              >
                View Full Item Master →
              </Button>
            </div>

            {/* GROUP TABS — Electronics is an umbrella over every appliance category */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 w-fit">
              {([
                { key: "all", label: "All Stock", icon: Package, qty: stockBreakdown.totalQuantity, value: stockBreakdown.totalStockValue },
                { key: "electronics", label: "Electronics", icon: Tv, qty: stockBreakdown.electronics.quantity, value: stockBreakdown.electronics.value },
                { key: "mobile", label: "Mobile", icon: Smartphone, qty: stockBreakdown.mobile.quantity, value: stockBreakdown.mobile.value },
              ] as const).map((g) => {
                const Icon = g.icon;
                const isActive = stockGroupFilter === g.key;
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => { setStockGroupFilter(g.key as any); setStockCategoryFilter("all"); }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                      isActive ? "bg-[#3F63AD] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {g.label}
                    <span className={cn(
                      "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded",
                      isActive ? "bg-white/25 text-white" : "bg-slate-200/80 text-slate-700"
                    )}>
                      {(g.qty || 0).toLocaleString("en-IN")}
                    </span>
                  </button>
                );
              })}
            </div>

            {stockGroupFilter === "electronics" && (
              <p className="text-[11px] text-slate-500 -mt-1">
                Electronics covers every appliance category — fridge, cooler, AC, TV, washing machine and more.
              </p>
            )}

            {/* Category Cards Grid — clicking a card filters the product list below */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {(stockBreakdown.categories || [])
                .filter((cat) => stockGroupFilter === "all" || (cat.group || "electronics") === stockGroupFilter)
                .filter((cat) => cat.name.toLowerCase().includes(stockSearchQuery.toLowerCase()))
                .map((cat, idx) => {
                  const percentage = stockBreakdown.totalStockValue > 0 ? ((cat.value / stockBreakdown.totalStockValue) * 100).toFixed(1) : "0";
                  const isActive = stockCategoryFilter.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <div
                      key={idx}
                      onClick={() => setStockCategoryFilter(isActive ? "all" : cat.name)}
                      className={cn(
                        "bg-white p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group",
                        isActive
                          ? "border-[#3F63AD] ring-2 ring-[#3F63AD]/20 shadow-md"
                          : "border-slate-200 hover:border-[#3F63AD] hover:shadow-md"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3F63AD]"></span>
                            <h4 className="font-bold text-slate-800 text-sm group-hover:text-[#3F63AD] transition-colors">
                              {cat.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 pl-4">
                            {cat.itemCount || "Multiple"} Product Lines · {percentage}% of Total Inventory
                          </p>
                        </div>
                        <Badge className="bg-blue-50 text-[#3F63AD] border-blue-200 font-mono font-bold text-xs">
                          {cat.quantity.toLocaleString("en-IN")} Qty
                        </Badge>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-semibold uppercase">Stock Valuation</span>
                          <p className="text-sm font-black text-slate-900">
                            {formatCurrency(cat.value)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className={cn(
                            "text-white text-xs h-8 px-3 font-semibold group-hover:shadow-sm",
                            isActive ? "bg-[#2C3E5A] hover:bg-[#1B2537]" : "bg-[#3F63AD] hover:bg-[#2C3E5A]"
                          )}
                        >
                          {isActive ? "Showing Items" : "View Stock Items"} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

              {(stockBreakdown.categories || [])
                .filter((cat) => stockGroupFilter === "all" || (cat.group || "electronics") === stockGroupFilter)
                .filter((cat) => cat.name.toLowerCase().includes(stockSearchQuery.toLowerCase()))
                .length === 0 && (
                <div className="md:col-span-2 py-10 flex flex-col items-center justify-center text-center bg-white rounded-xl border border-dashed border-slate-200">
                  <Package className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-600">No stock categories found</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {stockSearchQuery || stockGroupFilter !== "all"
                      ? "Try clearing the search or switching group."
                      : "Add products in Item Master to build your inventory catalog."}
                  </p>
                </div>
              )}
            </div>

            {/* PRODUCT LIST — actual items behind the category totals */}
            {(() => {
              const q = stockSearchQuery.trim().toLowerCase();
              const visibleItems = stockItems
                .filter((it: any) =>
                  stockGroupFilter === "all" || (it.group || "electronics") === stockGroupFilter
                )
                .filter((it: any) =>
                  stockCategoryFilter === "all" ||
                  (it.category || "").toLowerCase() === stockCategoryFilter.toLowerCase()
                )
                .filter((it: any) =>
                  !q ||
                  (it.name || "").toLowerCase().includes(q) ||
                  (it.brand || "").toLowerCase().includes(q) ||
                  (it.category || "").toLowerCase().includes(q) ||
                  (it.vpCode || "").toLowerCase().includes(q)
                )
                .sort((a: any, b: any) => (b.stockValue || 0) - (a.stockValue || 0));

              return (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Stock Items
                      </span>
                      <Badge className="bg-slate-200 text-slate-700 border-slate-300 text-[10px] font-mono font-bold">
                        {visibleItems.length}
                      </Badge>
                    </div>
                    {stockCategoryFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setStockCategoryFilter("all")}
                        className="text-[11px] font-bold text-[#3F63AD] hover:underline flex items-center gap-1"
                      >
                        <X className="w-3 h-3" /> Clear "{stockCategoryFilter}"
                      </button>
                    )}
                  </div>

                  {visibleItems.length === 0 ? (
                    <div className="py-10 flex flex-col items-center justify-center text-center">
                      <Search className="w-7 h-7 text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-500">No products match this filter</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-white sticky top-0 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2">Product</th>
                            <th className="px-4 py-2">Category</th>
                            <th className="px-4 py-2 text-right">Qty</th>
                            <th className="px-4 py-2 text-right">Rate</th>
                            <th className="px-4 py-2 text-right">Stock Value</th>
                            <th className="px-4 py-2 text-right">Open</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleItems.slice(0, 100).map((it: any) => (
                            <tr
                              key={it._id || it.code}
                              onClick={() => openProductLedger(it)}
                              title="Open product ledger"
                              className="hover:bg-slate-50 cursor-pointer transition-colors"
                            >
                              <td className="px-4 py-2.5">
                                <p className="font-bold text-slate-900 truncate max-w-[240px]">{it.name}</p>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {it.vpCode || it.code} • {it.brand}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">{it.category}</td>
                              <td className="px-4 py-2.5 text-right">
                                <span
                                  className={cn(
                                    "font-mono font-bold",
                                    (it.availableQty || 0) > 0 ? "text-emerald-700" : "text-rose-600"
                                  )}
                                >
                                  {it.availableQty || 0}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                                {formatCurrency(it.sellingPrice || 0)}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-black text-slate-900">
                                {formatCurrency(it.stockValue || 0)}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); openProductLedger(it); }}
                                    title="Open product ledger"
                                    className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:text-[#3F63AD] hover:border-[#3F63AD] transition-colors"
                                  >
                                    Ledger
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenStockModal(false);
                                      openProductMaster(it);
                                    }}
                                    title="Open in Item Master"
                                    className="h-7 px-2 rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-600 hover:text-purple-700 hover:border-purple-400 transition-colors"
                                  >
                                    Master
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {visibleItems.length > 100 && (
                        <p className="text-[11px] text-slate-400 text-center py-2 border-t border-slate-100">
                          Showing first 100 of {visibleItems.length} items — use search to narrow down.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Footer */}
          <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Gorakhpur Store Physical Inventory Directory
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenStockModal(false)}
              className="px-5 font-bold"
            >
              Close Window
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── PRODUCT LEDGER (purchases, sales & serials for one item) ──── */}
      <ProductLedgerModal
        isOpen={!!ledgerProduct}
        onClose={() => setLedgerProduct(null)}
        productIdentifier={ledgerProduct}
      />

      {/* ─── QUICK ASSIGN TASK MODAL ───────────────────────────────────── */}
      <Dialog open={isNewTaskModalOpen} onOpenChange={setIsNewTaskModalOpen}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <div className="bg-gradient-to-r from-[#1E293B] via-[#30539C] to-[#1E293B] text-white p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <CheckSquare className="w-5 h-5 text-purple-300" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight">Assign Task / Self-Goal</h3>
                <p className="text-xs text-slate-300">Delegate tasks to showroom staff or assign self-admin task</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateTaskSubmit} className="p-5 space-y-4 bg-slate-50">
            <div>
              <Label className="text-xs font-bold text-slate-700">Task Title *</Label>
              <Input
                value={taskForm.taskTitle}
                onChange={(e) => setTaskForm({ ...taskForm, taskTitle: e.target.value })}
                placeholder="e.g. Verify Bajaj Finance DO Settlement"
                required
                className="mt-1 bg-white font-medium text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Assign To *</Label>
                <select
                  value={taskForm.assignedStaff}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedStaff: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs font-bold shadow-xs focus:outline-none"
                >
                  <option value="Admin (Self)">👑 Admin (Self)</option>
                  <option value="Amit Singh">👤 Amit Singh</option>
                  <option value="Rahul Verma">👤 Rahul Verma</option>
                  <option value="Priya Sharma">👤 Priya Sharma</option>
                  <option value="Pooja Gupta">👤 Pooja Gupta</option>
                  <option value="Rakesh Patel">👤 Rakesh Patel</option>
                  <option value="Vikash Kumar">👤 Vikash Kumar</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Priority</Label>
                <select
                  value={taskForm.priority}
                  onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs font-bold shadow-xs focus:outline-none"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Urgent">🔥 Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  className="mt-1 bg-white text-xs h-9 font-medium"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Due Time</Label>
                <Input
                  type="time"
                  value={taskForm.dueTime}
                  onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                  className="mt-1 bg-white text-xs h-9 font-medium"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Description / Instructions</Label>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Add actionable instructions, invoice numbers, or customer notes..."
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs font-medium shadow-xs focus:outline-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewTaskModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-[#30539C] hover:bg-[#1E3A8A] text-white font-bold px-4">
                Assign Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── QUICK ADD LEAD MODAL ──────────────────────────────────────── */}
      <Dialog open={isNewLeadModalOpen} onOpenChange={setIsNewLeadModalOpen}>
        <DialogContent className="max-w-lg p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <div className="bg-gradient-to-r from-[#1B2537] via-[#10B981]/80 to-[#1B2537] text-white p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight">Register New Lead / Enquiry</h3>
                <p className="text-xs text-slate-200">Capture walk-in customer enquiry & schedule follow-up</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateLeadSubmit} className="p-5 space-y-3.5 bg-slate-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Customer Name *</Label>
                <Input
                  value={leadForm.customerName}
                  onChange={(e) => setLeadForm({ ...leadForm, customerName: e.target.value })}
                  placeholder="e.g. Ramesh Srivastava"
                  required
                  className="mt-1 bg-white text-xs h-9 font-medium"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Mobile Number *</Label>
                <Input
                  value={leadForm.mobile}
                  onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value })}
                  placeholder="10-digit mobile"
                  required
                  className="mt-1 bg-white text-xs h-9 font-mono font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Interested Product *</Label>
                <Input
                  value={leadForm.interestedProduct}
                  onChange={(e) => setLeadForm({ ...leadForm, interestedProduct: e.target.value })}
                  placeholder="e.g. Samsung 65' Neo QLED TV"
                  required
                  className="mt-1 bg-white text-xs h-9 font-medium"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Estimated Amount (₹)</Label>
                <Input
                  type="number"
                  value={leadForm.estimatedValue}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                  placeholder="e.g. 125000"
                  className="mt-1 bg-white text-xs h-9 font-mono font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Assigned Staff</Label>
                <select
                  value={leadForm.assignedStaff}
                  onChange={(e) => setLeadForm({ ...leadForm, assignedStaff: e.target.value })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-white px-2 py-1 text-xs font-medium shadow-xs focus:outline-none"
                >
                  <option value="Amit Singh">Amit Singh</option>
                  <option value="Rahul Verma">Rahul Verma</option>
                  <option value="Priya Sharma">Priya Sharma</option>
                  <option value="Pooja Gupta">Pooja Gupta</option>
                  <option value="Sales Team">Sales Team</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Status</Label>
                <select
                  value={leadForm.status}
                  onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as any })}
                  className="mt-1 w-full h-9 rounded-md border border-input bg-white px-2 py-1 text-xs font-bold shadow-xs focus:outline-none"
                >
                  <option value="New">New</option>
                  <option value="Follow-up">Follow-up</option>
                  <option value="Interested">Interested</option>
                  <option value="Converted">Converted</option>
                  <option value="Lost">Lost</option>
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Follow-up Date</Label>
                <Input
                  type="date"
                  value={leadForm.followUpDate}
                  onChange={(e) => setLeadForm({ ...leadForm, followUpDate: e.target.value })}
                  className="mt-1 bg-white text-xs h-9 font-medium"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Discussion Notes</Label>
              <textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                placeholder="Discount discussed, EMI scheme preferred, delivery preferences..."
                rows={2}
                className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-xs font-medium shadow-xs focus:outline-none"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewLeadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-[#76C043] hover:bg-[#60a82c] text-white font-bold px-4">
                Save Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── CLEAR DUE / SETTLEMENT MODAL ───────────────────────── */}
      <Dialog open={!!selectedDueInvoice} onOpenChange={() => setSelectedDueInvoice(null)}>
        <DialogContent className="max-w-md p-0 rounded-2xl overflow-hidden border-none shadow-2xl">
          <div className="bg-gradient-to-r from-[#1B2537] via-[#243753] to-[#1B2537] text-white p-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Clear Due & Record Settlement</h3>
                <p className="text-xs text-slate-300">
                  Invoice #{selectedDueInvoice?.invoiceNumber} • {selectedDueInvoice?.customerName}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleConfirmClearDue} className="p-5 bg-slate-50 space-y-4">
            <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-rose-900">Outstanding Due Balance</p>
                <p className="text-xs text-slate-500">Total: {formatCurrency(selectedDueInvoice?.total || 0)}</p>
              </div>
              <p className="text-2xl font-black text-rose-700 font-mono">
                {formatCurrency(selectedDueInvoice?.balanceAmount || 0)}
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800">Payment Collection Mode *</Label>
              <Select value={clearDuePaymentMode} onValueChange={setClearDuePaymentMode}>
                <SelectTrigger className="bg-white border-slate-300 mt-1 font-bold text-slate-900"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">💵 Cash at Counter</SelectItem>
                  <SelectItem value="UPI">📱 UPI / QR Code (PhonePe, GPay, Paytm)</SelectItem>
                  <SelectItem value="Card">💳 POS Debit / Credit Card</SelectItem>
                  <SelectItem value="Bank Transfer">🏦 Direct Bank Transfer / NEFT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800">Collected / Cleared By (Staff Name)</Label>
              <Select value={clearDueStaff} onValueChange={setClearDueStaff}>
                <SelectTrigger className="bg-white border-slate-300 mt-1 font-semibold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMIT SINGH">AMIT SINGH (Store Exec)</SelectItem>
                  <SelectItem value="ROHAN VERMA">ROHAN VERMA (Counter)</SelectItem>
                  <SelectItem value="PRIYA SHARMA">PRIYA SHARMA (Cashier)</SelectItem>
                  <SelectItem value="STORE MANAGER">STORE MANAGER (Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800">Transaction Ref / UTR / Note (Optional)</Label>
              <Input 
                placeholder="e.g. UPI Ref #4829103984 / Cash Slip" 
                value={clearDueTxnId} 
                onChange={(e) => setClearDueTxnId(e.target.value)} 
                className="bg-white border-slate-300 mt-1 text-xs" 
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-800">Settlement Notes</Label>
              <Input 
                placeholder="e.g. Balance cleared in full by customer" 
                value={clearDueNotes} 
                onChange={(e) => setClearDueNotes(e.target.value)} 
                className="bg-white border-slate-300 mt-1 text-xs" 
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSelectedDueInvoice(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isClearingDue} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5">
                {isClearingDue ? "Clearing..." : "Confirm & Clear Due (₹" + Number(selectedDueInvoice?.balanceAmount || 0).toLocaleString("en-IN") + ")"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

