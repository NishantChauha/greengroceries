import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, API } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast, Toaster } from "sonner";
import {
  LayoutDashboard, ListOrdered, ClipboardList, Box, Hotel, Download,
  Plus, Trash2, Pencil, Loader2, KeyRound, BarChart3, Receipt, FileSpreadsheet, FileText,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, AreaChart, Area,
} from "recharts";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function StatusBadge({ status }) {
  const map = {
    pending: "border-[#FFE0B2] bg-[#FFF4E5] text-[#B36B00]",
    delivered: "border-[#C8E6C9] bg-[#E8F5E9] text-[#1F4A2C]",
    cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${map[status] || ""}`} data-testid="order-status-badge">
      {status}
    </span>
  );
}

function Stat({ label, value, hint, icon: Icon }) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
            <div className="mt-2 font-serif text-4xl font-light tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</div>
            {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
          </div>
          <span className="gg-leaf inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [hotels, setHotels] = useState([]);

  // Purchase sheet
  const [sheetMode, setSheetMode] = useState("date"); // date | range
  const [sheetFrom, setSheetFrom] = useState(todayStr());
  const [sheetTo, setSheetTo] = useState(todayStr());
  const [sheet, setSheet] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // Orders filter
  const [ordersFilter, setOrdersFilter] = useState("");
  const [hotelFilterId, setHotelFilterId] = useState("all");
  const [ordersDateFrom, setOrdersDateFrom] = useState("");
  const [ordersDateTo, setOrdersDateTo] = useState("");

  // Edit order dialog
  const [editOrder, setEditOrder] = useState(null); // {order} or null

  // Items dialog
  const [itemDialog, setItemDialog] = useState({ open: false, mode: "add", current: null });
  const [itemForm, setItemForm] = useState({ name: "", category: "vegetable", unit: "kg", icon: "" });

  // Hotel dialog (create or reset password)
  const [hotelDialog, setHotelDialog] = useState({ open: false, mode: "add", current: null });
  const blankHotelForm = { email: "", password: "", name: "", hotel_name: "", phone: "", address: "" };
  const [hotelForm, setHotelForm] = useState(blankHotelForm);
  const [showHotelPwd, setShowHotelPwd] = useState(true);

  const loadStats = async () => { try { const { data } = await api.get("/stats"); setStats(data); } catch (e) { toast.error("Stats: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadOrders = async () => { try { const { data } = await api.get("/orders"); setOrders(data); } catch (e) { toast.error("Orders: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadItems = async () => { try { const { data } = await api.get("/items"); setItems(data); } catch (e) { toast.error("Items: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadHotels = async () => { try { const { data } = await api.get("/hotels"); setHotels(data); } catch (e) { toast.error("Hotels: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const [analytics, setAnalytics] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const loadAnalytics = async (days = analyticsDays) => {
    try { const { data } = await api.get("/analytics", { params: { days } }); setAnalytics(data); }
    catch (e) { toast.error("Analytics: " + (formatApiError(e.response?.data?.detail) || e.message)); }
  };

  useEffect(() => { loadStats(); loadOrders(); loadItems(); loadHotels(); loadAnalytics(); }, []);

  const fetchSheet = async () => {
    setLoadingSheet(true);
    try {
      const params = sheetMode === "date" ? { date_from: sheetFrom } : { date_from: sheetFrom, date_to: sheetTo };
      const { data } = await api.get("/purchase-sheet", { params });
      setSheet(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoadingSheet(false);
    }
  };

  useEffect(() => { fetchSheet(); }, []);

  const exportSheet = (fmt) => {
    const qs = new URLSearchParams({ fmt });
    qs.set("date_from", sheetFrom);
    if (sheetMode === "range") qs.set("date_to", sheetTo);
    const t = localStorage.getItem("gg_token");
    fetch(`${API}/purchase-sheet/export?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const range = sheetMode === "range" ? `${sheetFrom}_to_${sheetTo}` : sheetFrom;
        a.download = `purchase_sheet_${range}.${fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Export failed"));
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
      loadStats();
      toast.success(`Order marked ${status}`);
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  const filteredOrders = useMemo(() => {
    let list = orders;
    if (hotelFilterId !== "all") list = list.filter((o) => o.hotel_id === hotelFilterId);
    if (ordersDateFrom) list = list.filter((o) => o.order_date >= ordersDateFrom);
    if (ordersDateTo) list = list.filter((o) => o.order_date <= ordersDateTo);
    if (!ordersFilter) return list;
    const q = ordersFilter.toLowerCase();
    return list.filter((o) =>
      o.hotel_name.toLowerCase().includes(q) ||
      o.order_date.includes(q) ||
      o.status.includes(q)
    );
  }, [orders, ordersFilter, hotelFilterId, ordersDateFrom, ordersDateTo]);

  const exportOrders = (fmt) => {
    const qs = new URLSearchParams({ fmt });
    if (hotelFilterId !== "all") qs.set("hotel_id", hotelFilterId);
    if (ordersDateFrom) qs.set("date_from", ordersDateFrom);
    if (ordersDateTo) qs.set("date_to", ordersDateTo);
    const t = localStorage.getItem("gg_token");
    fetch(`${API}/orders/export?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const label = hotelFilterId === "all" ? "all-hotels" : "filtered";
        a.download = `orders_${label}.${fmt === "xlsx" ? "xlsx" : fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Export failed"));
  };

  const downloadBill = (orderId, kind /* "invoice" | "inventory" */) => {
    const t = localStorage.getItem("gg_token");
    const file = kind === "inventory" ? "inventory.pdf" : "invoice.pdf";
    fetch(`${API}/orders/${orderId}/${file}`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${kind}_${orderId.slice(-6)}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error(`${kind} download failed`));
  };

  const downloadInvoice = (orderId) => downloadBill(orderId, "invoice");

  const saveOrderEdit = async () => {
    if (!editOrder) return;
    try {
      const { data } = await api.put(`/orders/${editOrder.id}`, {
        lines: editOrder.lines,
        notes: editOrder.notes,
        tax_rate: Number(editOrder.tax_rate) || 0,
      });
      setOrders(orders.map((o) => (o.id === data.id ? data : o)));
      setEditOrder(null);
      toast.success("Order updated", { description: `Grand total: ₹ ${data.grand_total.toFixed(2)}` });
      loadStats();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  // Item CRUD
  const openAddItem = () => {
    setItemForm({ name: "", category: "vegetable", unit: "kg", icon: "", default_rate: 0, customCategory: "", customUnit: "" });
    setItemDialog({ open: true, mode: "add", current: null });
  };
  const openEditItem = (it) => {
    setItemForm({
      name: it.name, category: it.category, unit: it.unit,
      icon: it.icon || "", default_rate: it.default_rate || 0,
      customCategory: "", customUnit: "",
    });
    setItemDialog({ open: true, mode: "edit", current: it });
  };
  const saveItem = async () => {
    try {
      const payload = {
        name: itemForm.name,
        icon: itemForm.icon,
        default_rate: Number(itemForm.default_rate) || 0,
        category: itemForm.category === "__custom__"
          ? (itemForm.customCategory || "").trim().toLowerCase().replace(/\s+/g, "_")
          : itemForm.category,
        unit: itemForm.unit === "__custom__" ? (itemForm.customUnit || "").trim() : itemForm.unit,
      };
      if (!payload.category) { toast.error("Category required"); return; }
      if (!payload.unit) { toast.error("Unit required"); return; }
      if (itemDialog.mode === "add") {
        await api.post("/items", payload);
        toast.success("Item added");
      } else {
        await api.put(`/items/${itemDialog.current.id}`, payload);
        toast.success("Item updated");
      }
      setItemDialog({ open: false, mode: "add", current: null });
      loadItems();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const removeItem = async (id) => {
    if (!window.confirm("Remove this item from catalog?")) return;
    try {
      await api.delete(`/items/${id}`);
      setItems(items.filter((it) => it.id !== id));
      toast.success("Item removed");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };

  // Hotel CRUD
  function genPassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
    let p = "";
    for (let i = 0; i < 10; i++) p += chars[Math.floor(Math.random() * chars.length)];
    return p;
  }
  const openAddHotel = () => {
    setHotelForm({ ...blankHotelForm, password: genPassword() });
    setShowHotelPwd(true);
    setHotelDialog({ open: true, mode: "add", current: null });
  };
  const openResetHotel = (h) => {
    setHotelForm({ ...blankHotelForm, password: genPassword(), hotel_name: h.hotel_name });
    setShowHotelPwd(true);
    setHotelDialog({ open: true, mode: "reset", current: h });
  };
  const saveHotel = async () => {
    try {
      if (hotelDialog.mode === "add") {
        const payload = { ...hotelForm, email: hotelForm.email.trim().toLowerCase() };
        await api.post("/hotels", payload);
        toast.success("Hotel created", {
          description: `${payload.email} · ${hotelForm.password}`,
          duration: 8000,
        });
      } else {
        await api.patch(`/hotels/${hotelDialog.current.id}/password`, { password: hotelForm.password });
        toast.success("Password reset", {
          description: `${hotelDialog.current.email} · ${hotelForm.password}`,
          duration: 8000,
        });
      }
      setHotelDialog({ open: false, mode: "add", current: null });
      loadHotels(); loadStats();
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const removeHotel = async (h) => {
    if (!window.confirm(`Remove hotel "${h.hotel_name}"? Their orders remain in history.`)) return;
    try {
      await api.delete(`/hotels/${h.id}`);
      setHotels(hotels.filter((x) => x.id !== h.id));
      loadStats();
      toast.success("Hotel removed");
    } catch (e) { toast.error(formatApiError(e.response?.data?.detail) || e.message); }
  };
  const copyHotelPwd = async () => {
    try {
      await navigator.clipboard.writeText(`${hotelForm.email || hotelDialog.current?.email}  /  ${hotelForm.password}`);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed — please copy manually");
    }
  };

  return (
    <AppShell nav={[]}>
      <Toaster richColors position="top-right" />

      {/* Edit order dialog (admin enters rates and tax) */}
      <Dialog open={!!editOrder} onOpenChange={(o) => { if (!o) setEditOrder(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="edit-order-dialog">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-normal">
              Edit order — {editOrder?.hotel_name}
            </DialogTitle>
          </DialogHeader>
          {editOrder ? (() => {
            const sub = (editOrder.lines || []).reduce(
              (s, ln) => s + (Number(ln.quantity) || 0) * (Number(ln.rate) || 0),
              0,
            );
            const tr = Number(editOrder.tax_rate) || 0;
            const tx = sub * tr / 100;
            const gt = sub + tx;
            return (
              <div className="space-y-4 py-2">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Order date: <span className="font-mono text-foreground">{editOrder.order_date}</span>
                </div>

                <div className="rounded-md border border-border">
                  <div className="grid grid-cols-12 gap-2 bg-[#F7F5F0] px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <div className="col-span-4">Item</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Unit</div>
                    <div className="col-span-2 text-right">Rate (₹)</div>
                    <div className="col-span-2 text-right">Amount</div>
                  </div>
                  {editOrder.lines.map((ln, idx) => {
                    const amt = (Number(ln.quantity) || 0) * (Number(ln.rate) || 0);
                    return (
                      <div key={idx} className="grid grid-cols-12 items-center gap-2 border-t border-border px-3 py-2" data-testid={`edit-line-${idx}`}>
                        <div className="col-span-4 text-sm font-medium">{ln.name}</div>
                        <div className="col-span-2">
                          <Input
                            type="number" min={0} step="0.1"
                            value={ln.quantity}
                            onChange={(e) => {
                              const lines = [...editOrder.lines];
                              lines[idx] = { ...ln, quantity: Number(e.target.value) };
                              setEditOrder({ ...editOrder, lines });
                            }}
                            className="text-right font-mono"
                            data-testid={`edit-qty-${idx}`}
                          />
                        </div>
                        <div className="col-span-2 text-right text-xs text-muted-foreground">{ln.unit}</div>
                        <div className="col-span-2">
                          <Input
                            type="number" min={0} step="0.01"
                            value={ln.rate ?? 0}
                            onChange={(e) => {
                              const lines = [...editOrder.lines];
                              lines[idx] = { ...ln, rate: Number(e.target.value) };
                              setEditOrder({ ...editOrder, lines });
                            }}
                            className="text-right font-mono"
                            placeholder="0"
                            data-testid={`edit-rate-${idx}`}
                          />
                        </div>
                        <div className="col-span-2 text-right font-mono text-sm" data-testid={`edit-amount-${idx}`}>
                          ₹ {amt.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="tax_rate">Tax %</Label>
                    <Input
                      id="tax_rate" type="number" min={0} step="0.5"
                      value={editOrder.tax_rate ?? 0}
                      onChange={(e) => setEditOrder({ ...editOrder, tax_rate: Number(e.target.value) })}
                      className="mt-1.5 font-mono"
                      data-testid="edit-tax-rate"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="edit_notes">Notes</Label>
                    <Input
                      id="edit_notes"
                      value={editOrder.notes ?? ""}
                      onChange={(e) => setEditOrder({ ...editOrder, notes: e.target.value })}
                      className="mt-1.5"
                      placeholder="Delivery instructions…"
                      data-testid="edit-notes"
                    />
                  </div>
                </div>

                <div className="rounded-md border border-dashed border-border bg-secondary p-3 font-mono text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span data-testid="edit-subtotal">₹ {sub.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax ({tr}%)</span><span data-testid="edit-tax">₹ {tx.toFixed(2)}</span></div>
                  <div className="mt-1 flex justify-between border-t border-border pt-1.5 text-base font-semibold text-primary">
                    <span>Grand Total</span><span data-testid="edit-grand-total">₹ {gt.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })() : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOrder(null)} data-testid="edit-cancel-button">Cancel</Button>
            <Button onClick={saveOrderEdit} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="edit-save-button">
              Save & recalculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mb-8">
        <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Admin control room</div>
        <h1 className="mt-1 font-serif text-4xl font-light tracking-tight" data-testid="admin-dashboard-title">
          Today’s produce, every hotel, one sheet.
        </h1>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="stats-grid">
        <Stat label="Hotels" value={stats?.total_hotels ?? "—"} hint="Registered" icon={Hotel} />
        <Stat label="Pending Orders" value={stats?.pending_orders ?? "—"} hint="Need processing" icon={ListOrdered} />
        <Stat label="Today Quantity" value={stats?.today_total_quantity ?? "—"} hint="Total units today" icon={ClipboardList} />
        <Stat label="Total Orders" value={stats?.total_orders ?? "—"} hint="All-time" icon={LayoutDashboard} />
      </div>

      <Tabs defaultValue="sheet" className="space-y-6">
        <TabsList data-testid="admin-tabs">
          <TabsTrigger value="sheet" data-testid="tab-sheet"><ClipboardList className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Purchase Sheet</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders"><ListOrdered className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Orders</TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items"><Box className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Items</TabsTrigger>
          <TabsTrigger value="hotels" data-testid="tab-hotels"><Hotel className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Hotels</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics"><BarChart3 className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Analytics</TabsTrigger>
        </TabsList>

        {/* Purchase sheet */}
        <TabsContent value="sheet" className="space-y-6">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="font-serif text-xl font-normal">Combined purchase sheet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label>Mode</Label>
                  <Select value={sheetMode} onValueChange={setSheetMode}>
                    <SelectTrigger className="mt-1.5 w-40" data-testid="sheet-mode-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date">Single date</SelectItem>
                      <SelectItem value="range">Date range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sheet_from">{sheetMode === "date" ? "Date" : "From"}</Label>
                  <Input id="sheet_from" type="date" value={sheetFrom} onChange={(e) => setSheetFrom(e.target.value)} data-testid="sheet-from-input" className="mt-1.5" />
                </div>
                {sheetMode === "range" ? (
                  <div>
                    <Label htmlFor="sheet_to">To</Label>
                    <Input id="sheet_to" type="date" value={sheetTo} onChange={(e) => setSheetTo(e.target.value)} data-testid="sheet-to-input" className="mt-1.5" />
                  </div>
                ) : null}
                <Button onClick={fetchSheet} disabled={loadingSheet} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="sheet-generate-button">
                  {loadingSheet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Generate
                </Button>
                <Button variant="outline" onClick={() => exportSheet("csv")} className="border-border" data-testid="export-csv-button">
                  <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> CSV
                </Button>
                <Button variant="outline" onClick={() => exportSheet("pdf")} className="border-border" data-testid="export-pdf-button">
                  <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> PDF
                </Button>
              </div>

              {sheet ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="border-border bg-secondary">
                      {sheet.date_from === sheet.date_to ? sheet.date_from : `${sheet.date_from} → ${sheet.date_to}`}
                    </Badge>
                    <Badge variant="outline" className="border-border bg-secondary">Hotels: {sheet.total_hotels}</Badge>
                    <Badge variant="outline" className="border-border bg-secondary">Orders: {sheet.total_orders}</Badge>
                  </div>
                  <div className="overflow-hidden rounded-md border border-border">
                    <Table data-testid="purchase-sheet-table">
                      <TableHeader>
                        <TableRow className="bg-[#F7F5F0]">
                          <TableHead>Item</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Total Quantity</TableHead>
                          <TableHead className="text-right">Hotels</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sheet.rows.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No orders in this period.</TableCell></TableRow>
                        ) : null}
                        {sheet.rows.map((r) => (
                          <TableRow key={r.name} data-testid={`sheet-row-${r.name.toLowerCase()}`}>
                            <TableCell className="font-medium">{r.name}</TableCell>
                            <TableCell className="capitalize text-muted-foreground">{r.category}</TableCell>
                            <TableCell className="text-muted-foreground">{r.unit}</TableCell>
                            <TableCell className="text-right font-mono text-base font-medium">{r.total_quantity}</TableCell>
                            <TableCell className="text-right font-mono">{r.hotel_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All orders */}
        <TabsContent value="orders">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="font-serif text-xl font-normal">All hotel orders</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={hotelFilterId} onValueChange={setHotelFilterId}>
                    <SelectTrigger className="w-48" data-testid="orders-hotel-filter">
                      <SelectValue placeholder="All hotels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All hotels</SelectItem>
                      {hotels.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.hotel_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="date"
                    value={ordersDateFrom}
                    onChange={(e) => setOrdersDateFrom(e.target.value)}
                    className="w-40"
                    placeholder="From"
                    data-testid="orders-date-from"
                  />
                  <Input
                    type="date"
                    value={ordersDateTo}
                    onChange={(e) => setOrdersDateTo(e.target.value)}
                    className="w-40"
                    placeholder="To"
                    data-testid="orders-date-to"
                  />
                  <Input
                    placeholder="Search…"
                    value={ordersFilter}
                    onChange={(e) => setOrdersFilter(e.target.value)}
                    className="w-36"
                    data-testid="orders-search-input"
                  />
                  <Button variant="outline" size="sm" onClick={() => exportOrders("xlsx")} className="border-border" data-testid="orders-export-xlsx">
                    <FileSpreadsheet className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportOrders("csv")} className="border-border" data-testid="orders-export-csv">
                    <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportOrders("pdf")} className="border-border" data-testid="orders-export-pdf">
                    <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="admin-orders-table">
                <TableHeader>
                  <TableRow className="bg-[#F7F5F0]">
                    <TableHead>Hotel</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No orders.</TableCell></TableRow>
                  ) : null}
                  {filteredOrders.map((o) => (
                    <TableRow key={o.id} data-testid={`admin-order-row-${o.id}`}>
                      <TableCell>
                        <div className="font-medium">{o.hotel_name}</div>
                        {o.notes ? <div className="text-xs text-muted-foreground">{o.notes}</div> : null}
                      </TableCell>
                      <TableCell className="font-mono">{o.order_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {o.lines.map((ln, idx) => (
                            <Badge key={(ln.item_id || "") + ln.name + idx} variant="outline" className="border-border bg-secondary">
                              {ln.name} <span className="ml-1 font-mono text-muted-foreground">· {ln.quantity}{ln.unit}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {o.grand_total > 0 ? (
                          <span className="font-medium" data-testid={`order-total-${o.id}`}>₹ {o.grand_total.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Set rates →</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="sm" onClick={() => setEditOrder({ ...o, lines: o.lines.map(l => ({ ...l })) })} data-testid={`edit-order-${o.id}`} title="Edit rates & quantities">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`bill-menu-${o.id}`} title="Download bill">
                                <Receipt className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                                Download bill
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => downloadBill(o.id, "inventory")} data-testid={`bill-inventory-${o.id}`}>
                                <FileText className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>Inventory bill</span>
                                  <span className="text-[11px] text-muted-foreground">Items & quantity only</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadBill(o.id, "invoice")} disabled={!o.grand_total} data-testid={`bill-invoice-${o.id}`}>
                                <Receipt className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>Invoice bill</span>
                                  <span className="text-[11px] text-muted-foreground">{o.grand_total ? `With prices · ₹ ${o.grand_total.toFixed(2)}` : "Set rates first"}</span>
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                            <SelectTrigger className="ml-1 w-32" data-testid={`status-select-${o.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="delivered">Delivered</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Items management */}
        <TabsContent value="items">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-xl font-normal">Catalog items</CardTitle>
                <Dialog open={itemDialog.open} onOpenChange={(o) => setItemDialog({ ...itemDialog, open: o })}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddItem} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="add-item-button">
                      <Plus className="mr-1.5 h-4 w-4" /> Add item
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="item-dialog">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-2xl font-normal">
                        {itemDialog.mode === "add" ? "Add catalog item" : "Edit item"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div>
                        <Label htmlFor="i_name">Name</Label>
                        <Input id="i_name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="mt-1.5" data-testid="item-name-input" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Category</Label>
                          {itemForm.category === "__custom__" ? (
                            <Input
                              autoFocus
                              value={itemForm.customCategory || ""}
                              onChange={(e) => setItemForm({ ...itemForm, customCategory: e.target.value })}
                              placeholder="e.g. spice, dairy"
                              className="mt-1.5"
                              data-testid="item-category-custom"
                            />
                          ) : (
                            <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                              <SelectTrigger className="mt-1.5" data-testid="item-category-select"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="vegetable">Vegetable</SelectItem>
                                <SelectItem value="fruit">Fruit</SelectItem>
                                <SelectItem value="leafy_green">Leafy green</SelectItem>
                                <SelectItem value="root">Root vegetable</SelectItem>
                                <SelectItem value="herb">Herb</SelectItem>
                                <SelectItem value="spice">Spice</SelectItem>
                                <SelectItem value="dairy">Dairy</SelectItem>
                                <SelectItem value="grocery">Grocery</SelectItem>
                                <SelectItem value="meat">Meat &amp; Poultry</SelectItem>
                                <SelectItem value="seafood">Seafood</SelectItem>
                                <SelectItem value="bakery">Bakery</SelectItem>
                                <SelectItem value="beverage">Beverage</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                                <SelectItem value="__custom__">+ Custom category…</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div>
                          <Label>Unit</Label>
                          {itemForm.unit === "__custom__" ? (
                            <Input
                              autoFocus
                              value={itemForm.customUnit || ""}
                              onChange={(e) => setItemForm({ ...itemForm, customUnit: e.target.value })}
                              placeholder="e.g. crate, sack"
                              className="mt-1.5"
                              data-testid="item-unit-custom"
                            />
                          ) : (
                            <Select value={itemForm.unit} onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}>
                              <SelectTrigger className="mt-1.5" data-testid="item-unit-select"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg (kilogram)</SelectItem>
                                <SelectItem value="g">g (gram)</SelectItem>
                                <SelectItem value="quintal">quintal</SelectItem>
                                <SelectItem value="dozen">dozen</SelectItem>
                                <SelectItem value="piece">piece</SelectItem>
                                <SelectItem value="bundle">bundle</SelectItem>
                                <SelectItem value="bunch">bunch</SelectItem>
                                <SelectItem value="packet">packet</SelectItem>
                                <SelectItem value="box">box</SelectItem>
                                <SelectItem value="crate">crate</SelectItem>
                                <SelectItem value="bag">bag</SelectItem>
                                <SelectItem value="ltr">ltr (litre)</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                                <SelectItem value="__custom__">+ Custom unit…</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="i_icon">Icon (emoji, optional)</Label>
                        <Input id="i_icon" value={itemForm.icon} onChange={(e) => setItemForm({ ...itemForm, icon: e.target.value })} className="mt-1.5" data-testid="item-icon-input" placeholder="🥕" />
                      </div>
                      <div>
                        <Label htmlFor="i_rate">Default rate per {itemForm.unit === "__custom__" ? "unit" : itemForm.unit} (₹)</Label>
                        <Input
                          id="i_rate" type="number" min={0} step="0.01"
                          value={itemForm.default_rate ?? 0}
                          onChange={(e) => setItemForm({ ...itemForm, default_rate: Number(e.target.value) })}
                          className="mt-1.5 font-mono"
                          data-testid="item-rate-input"
                          placeholder="0"
                        />
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          Used to auto-fill rate on new orders. Admin can override per order.
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={saveItem} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="item-save-button">Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="items-table">
                <TableHeader>
                  <TableRow className="bg-[#F7F5F0]">
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Default rate</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id} data-testid={`item-row-${it.name.toLowerCase()}`}>
                      <TableCell className="font-medium"><span className="mr-2 text-lg">{it.icon}</span>{it.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{(it.category || "").replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{it.unit}</TableCell>
                      <TableCell className="text-right font-mono">
                        {it.default_rate > 0 ? `₹ ${Number(it.default_rate).toFixed(2)}` : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditItem(it)} data-testid={`edit-item-${it.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => removeItem(it.id)} data-testid={`delete-item-${it.id}`} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hotels list */}
        <TabsContent value="hotels">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="font-serif text-xl font-normal">Registered hotels</CardTitle>
                <Dialog open={hotelDialog.open} onOpenChange={(o) => setHotelDialog({ ...hotelDialog, open: o })}>
                  <DialogTrigger asChild>
                    <Button onClick={openAddHotel} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="add-hotel-button">
                      <Plus className="mr-1.5 h-4 w-4" /> Add hotel
                    </Button>
                  </DialogTrigger>
                  <DialogContent data-testid="hotel-dialog" className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="font-serif text-2xl font-normal">
                        {hotelDialog.mode === "add" ? "Create hotel login" : `Reset password — ${hotelDialog.current?.hotel_name}`}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      {hotelDialog.mode === "add" ? (
                        <>
                          <div>
                            <Label htmlFor="h_hotel">Hotel name</Label>
                            <Input id="h_hotel" value={hotelForm.hotel_name} onChange={(e) => setHotelForm({ ...hotelForm, hotel_name: e.target.value })} className="mt-1.5" data-testid="hotel-name-input" placeholder="Grand Plaza" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="h_name">Contact name</Label>
                              <Input id="h_name" value={hotelForm.name} onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })} className="mt-1.5" data-testid="hotel-contact-input" placeholder="Mr. Sharma" />
                            </div>
                            <div>
                              <Label htmlFor="h_phone">Phone</Label>
                              <Input id="h_phone" value={hotelForm.phone} onChange={(e) => setHotelForm({ ...hotelForm, phone: e.target.value })} className="mt-1.5" data-testid="hotel-phone-input" placeholder="+91…" />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="h_email">Email (used to log in)</Label>
                            <Input id="h_email" type="email" value={hotelForm.email} onChange={(e) => setHotelForm({ ...hotelForm, email: e.target.value })} className="mt-1.5" data-testid="hotel-email-input" placeholder="orders@hotel.com" />
                          </div>
                          <div>
                            <Label htmlFor="h_addr">Address (optional)</Label>
                            <Input id="h_addr" value={hotelForm.address} onChange={(e) => setHotelForm({ ...hotelForm, address: e.target.value })} className="mt-1.5" data-testid="hotel-address-input" />
                          </div>
                        </>
                      ) : null}

                      <div>
                        <Label htmlFor="h_pwd">Password (visible — share with hotel)</Label>
                        <div className="mt-1.5 flex gap-2">
                          <Input
                            id="h_pwd"
                            type={showHotelPwd ? "text" : "password"}
                            value={hotelForm.password}
                            onChange={(e) => setHotelForm({ ...hotelForm, password: e.target.value })}
                            data-testid="hotel-password-input"
                            className="font-mono"
                          />
                          <Button type="button" variant="outline" onClick={() => setShowHotelPwd(!showHotelPwd)} data-testid="hotel-pwd-toggle">
                            {showHotelPwd ? "Hide" : "Show"}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setHotelForm({ ...hotelForm, password: genPassword() })} data-testid="hotel-pwd-regen">
                            New
                          </Button>
                        </div>
                        <div className="mt-1.5 text-xs text-muted-foreground">
                          Min 6 chars. Once saved, you’ll see it in a toast — copy & share it with the hotel.
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button variant="outline" onClick={copyHotelPwd} data-testid="hotel-copy-button">Copy credentials</Button>
                      <Button onClick={saveHotel} className="bg-primary text-primary-foreground hover:bg-[#163820]" data-testid="hotel-save-button">
                        {hotelDialog.mode === "add" ? "Create hotel" : "Reset password"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="hotels-table">
                <TableHeader>
                  <TableRow className="bg-[#F7F5F0]">
                    <TableHead>Hotel</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No hotels yet. Click &ldquo;Add hotel&rdquo; to create the first login.</TableCell></TableRow>
                  ) : null}
                  {hotels.map((h) => (
                    <TableRow key={h.id} data-testid={`hotel-row-${h.id}`}>
                      <TableCell className="font-medium">{h.hotel_name}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{h.email}</TableCell>
                      <TableCell className="text-muted-foreground">{h.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.address || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openResetHotel(h)} data-testid={`reset-hotel-${h.id}`} title="Reset password">
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeHotel(h)} data-testid={`delete-hotel-${h.id}`} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Period</div>
              <div className="font-mono text-sm">
                {analytics ? `${analytics.range.from} → ${analytics.range.to}` : "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(analyticsDays)} onValueChange={(v) => { setAnalyticsDays(Number(v)); loadAnalytics(Number(v)); }}>
                <SelectTrigger className="w-32" data-testid="analytics-range-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <CardTitle className="font-serif text-xl font-normal">Daily order volume</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-72" data-testid="chart-volume">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.weekly_volume || []} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gQty" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#1F4A2C" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#1F4A2C" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E5E0D8" vertical={false} />
                    <XAxis dataKey="date" stroke="#747A76" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                    <YAxis stroke="#747A76" fontSize={11} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E0D8", borderRadius: 8 }} />
                    <Area type="monotone" dataKey="quantity" stroke="#1F4A2C" strokeWidth={2} fill="url(#gQty)" name="Quantity" />
                    <Area type="monotone" dataKey="orders" stroke="#D4A373" strokeWidth={1.5} fill="none" name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="font-serif text-xl font-normal">Top items</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72" data-testid="chart-top-items">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.top_items || []} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid stroke="#E5E0D8" horizontal={false} />
                      <XAxis type="number" stroke="#747A76" fontSize={11} />
                      <YAxis type="category" dataKey="name" stroke="#747A76" fontSize={11} width={90} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E0D8", borderRadius: 8 }} />
                      <Bar dataKey="quantity" fill="#1F4A2C" radius={[0, 4, 4, 0]} name="Total quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="font-serif text-xl font-normal">Top hotels</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="h-72" data-testid="chart-top-hotels">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.top_hotels || []} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid stroke="#E5E0D8" horizontal={false} />
                      <XAxis type="number" stroke="#747A76" fontSize={11} />
                      <YAxis type="category" dataKey="hotel_name" stroke="#747A76" fontSize={11} width={110} />
                      <Tooltip contentStyle={{ background: "#fff", border: "1px solid #E5E0D8", borderRadius: 8 }} />
                      <Bar dataKey="quantity" fill="#D4A373" radius={[0, 4, 4, 0]} name="Total quantity" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
