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
import { toast, Toaster } from "sonner";
import {
  LayoutDashboard, ListOrdered, ClipboardList, Box, Hotel, Download,
  Plus, Trash2, Pencil, Loader2,
} from "lucide-react";

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

  // Items dialog
  const [itemDialog, setItemDialog] = useState({ open: false, mode: "add", current: null });
  const [itemForm, setItemForm] = useState({ name: "", category: "vegetable", unit: "kg", icon: "" });

  const loadStats = async () => { try { const { data } = await api.get("/stats"); setStats(data); } catch (e) { toast.error("Stats: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadOrders = async () => { try { const { data } = await api.get("/orders"); setOrders(data); } catch (e) { toast.error("Orders: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadItems = async () => { try { const { data } = await api.get("/items"); setItems(data); } catch (e) { toast.error("Items: " + (formatApiError(e.response?.data?.detail) || e.message)); } };
  const loadHotels = async () => { try { const { data } = await api.get("/hotels"); setHotels(data); } catch (e) { toast.error("Hotels: " + (formatApiError(e.response?.data?.detail) || e.message)); } };

  useEffect(() => { loadStats(); loadOrders(); loadItems(); loadHotels(); }, []);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSheet(); }, []);

  const exportCsv = () => {
    const params = sheetMode === "date"
      ? `date_from=${sheetFrom}`
      : `date_from=${sheetFrom}&date_to=${sheetTo}`;
    const url = `${API}/purchase-sheet/export?${params}`;
    window.open(url, "_blank");
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
    if (!ordersFilter) return orders;
    const q = ordersFilter.toLowerCase();
    return orders.filter((o) =>
      o.hotel_name.toLowerCase().includes(q) ||
      o.order_date.includes(q) ||
      o.status.includes(q)
    );
  }, [orders, ordersFilter]);

  // Item CRUD
  const openAddItem = () => {
    setItemForm({ name: "", category: "vegetable", unit: "kg", icon: "" });
    setItemDialog({ open: true, mode: "add", current: null });
  };
  const openEditItem = (it) => {
    setItemForm({ name: it.name, category: it.category, unit: it.unit, icon: it.icon || "" });
    setItemDialog({ open: true, mode: "edit", current: it });
  };
  const saveItem = async () => {
    try {
      if (itemDialog.mode === "add") {
        await api.post("/items", itemForm);
        toast.success("Item added");
      } else {
        await api.put(`/items/${itemDialog.current.id}`, itemForm);
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

  return (
    <AppShell nav={[]}>
      <Toaster richColors position="top-right" />

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
                <Button variant="outline" onClick={exportCsv} className="border-border" data-testid="export-csv-button">
                  <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Export CSV
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
                <Input
                  placeholder="Search hotel, date, or status…"
                  value={ordersFilter}
                  onChange={(e) => setOrdersFilter(e.target.value)}
                  className="max-w-xs"
                  data-testid="orders-search-input"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="admin-orders-table">
                <TableHeader>
                  <TableRow className="bg-[#F7F5F0]">
                    <TableHead>Hotel</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No orders.</TableCell></TableRow>
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
                          {o.lines.map((ln) => (
                            <Badge key={ln.item_id + ln.name} variant="outline" className="border-border bg-secondary">
                              {ln.name} <span className="ml-1 font-mono text-muted-foreground">· {ln.quantity}{ln.unit}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-right">
                        <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                          <SelectTrigger className="ml-auto w-36" data-testid={`status-select-${o.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                            <SelectTrigger className="mt-1.5" data-testid="item-category-select"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="vegetable">Vegetable</SelectItem>
                              <SelectItem value="fruit">Fruit</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="i_unit">Unit</Label>
                          <Input id="i_unit" value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} className="mt-1.5" data-testid="item-unit-input" placeholder="kg, dozen, piece" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="i_icon">Icon (emoji, optional)</Label>
                        <Input id="i_icon" value={itemForm.icon} onChange={(e) => setItemForm({ ...itemForm, icon: e.target.value })} className="mt-1.5" data-testid="item-icon-input" placeholder="🥕" />
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
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id} data-testid={`item-row-${it.name.toLowerCase()}`}>
                      <TableCell className="font-medium"><span className="mr-2 text-lg">{it.icon}</span>{it.name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{it.category}</TableCell>
                      <TableCell className="text-muted-foreground">{it.unit}</TableCell>
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
              <CardTitle className="font-serif text-xl font-normal">Registered hotels</CardTitle>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hotels.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No hotels registered yet.</TableCell></TableRow>
                  ) : null}
                  {hotels.map((h) => (
                    <TableRow key={h.id} data-testid={`hotel-row-${h.id}`}>
                      <TableCell className="font-medium">{h.hotel_name}</TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell className="text-muted-foreground">{h.email}</TableCell>
                      <TableCell className="text-muted-foreground">{h.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.address || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
