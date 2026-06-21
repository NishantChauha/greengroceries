import { useEffect, useMemo, useState } from "react";
import { api, formatApiError, API } from "@/api/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast, Toaster } from "sonner";
import { Loader2, ShoppingBasket, History, Carrot, Apple, Download, Receipt, FileText } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${map[status] || ""}`}
      data-testid="order-status-badge"
    >
      {status}
    </span>
  );
}

export default function HotelDashboard() {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [qty, setQty] = useState({}); // {item_id: number}
  const [orderDate, setOrderDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [it, ord] = await Promise.all([api.get("/items"), api.get("/orders")]);
      setItems(it.data);
      setOrders(ord.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // Group items by their category dynamically (supports new categories)
  const itemGroups = useMemo(() => {
    const groups = new Map();
    for (const it of items) {
      const cat = it.category || "other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(it);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  const formatCategory = (c) =>
    (c || "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  const totalLines = useMemo(
    () => Object.values(qty).filter((v) => Number(v) > 0).length,
    [qty]
  );
  const totalQty = useMemo(
    () => Object.values(qty).reduce((s, v) => s + (Number(v) || 0), 0),
    [qty]
  );

  const submitOrder = async (e) => {
    e.preventDefault();
    const lines = items
      .map((it) => ({ item_id: it.id, name: it.name, unit: it.unit, category: it.category, quantity: Number(qty[it.id] || 0) }))
      .filter((l) => l.quantity > 0);

    if (!lines.length) {
      toast.error("Add quantity for at least one item");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/orders", { order_date: orderDate, notes, lines });
      toast.success("Order placed!", { description: `${lines.length} items for ${orderDate}` });
      setQty({});
      setNotes("");
      setOrderDate(todayStr());
      const ord = await api.get("/orders");
      setOrders(ord.data);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async (id) => {
    if (!window.confirm("Cancel this order? It will remain in your history.")) return;
    try {
      await api.patch(`/orders/${id}/status`, { status: "cancelled" });
      setOrders(orders.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o)));
      toast.success("Order cancelled");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const exportHistory = (fmt) => {
    const t = localStorage.getItem("gg_token");
    fetch(`${API}/orders/export?fmt=${fmt}`, {
      headers: { Authorization: `Bearer ${t}` },
      credentials: "include",
    })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `my_orders.${fmt === "xlsx" ? "xlsx" : fmt}`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Export failed"));
  };

  const downloadBill = (orderId, kind) => {
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

  const renderItem = (it) => (
    <div
      key={it.id}
      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 transition-colors hover:bg-[#F9F8F6]"
      data-testid={`order-item-row-${it.name.toLowerCase()}`}
    >
      <span className="text-xl">{it.icon}</span>
      <div className="flex-1">
        <div className="text-sm font-medium">{it.name}</div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{it.unit}</div>
      </div>
      <Input
        type="number"
        min={0}
        step="0.5"
        placeholder="0"
        value={qty[it.id] ?? ""}
        onChange={(e) => setQty({ ...qty, [it.id]: e.target.value })}
        className="w-24 text-right font-mono"
        data-testid={`qty-input-${it.name.toLowerCase()}`}
      />
    </div>
  );

  return (
    <AppShell nav={[
      { key: "place", label: "Place Order", to: "/hotel" },
      { key: "history", label: "Order History", to: "/hotel?tab=history" },
    ]}>
      <Toaster richColors position="top-right" />

      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Hotel dashboard</div>
          <h1 className="mt-1 font-serif text-4xl font-light tracking-tight" data-testid="hotel-dashboard-title">
            Today’s order, beautifully simple.
          </h1>
        </div>
      </div>

      <Tabs defaultValue="place" className="space-y-6">
        <TabsList data-testid="hotel-tabs">
          <TabsTrigger value="place" data-testid="tab-place"><ShoppingBasket className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Place order</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history"><History className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Order history</TabsTrigger>
        </TabsList>

        {/* Place order */}
        <TabsContent value="place" className="space-y-6">
          <form onSubmit={submitOrder} className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="hotel-order-form">
            {/* Left: items grouped by category */}
            <div className="space-y-6 lg:col-span-2">
              {itemGroups.map(([cat, list]) => (
                <Card key={cat} className="border-border">
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 font-serif text-xl font-normal">
                      {cat === "fruit"
                        ? <Apple className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        : <Carrot className="h-4 w-4 text-primary" strokeWidth={1.5} />}
                      {formatCategory(cat)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">({list.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-2 pt-4 sm:grid-cols-2">
                    {list.map(renderItem)}
                  </CardContent>
                </Card>
              ))}
              {!itemGroups.length && !loading ? (
                <Card className="border-border"><CardContent className="p-6 text-sm text-muted-foreground">
                  No catalog items yet. Ask the admin to add some.
                </CardContent></Card>
              ) : null}
            </div>

            {/* Right: summary */}
            <div className="space-y-6">
              <Card className="border-border">
                <CardHeader className="border-b border-border">
                  <CardTitle className="font-serif text-xl font-normal">Order details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="order_date">Delivery date</Label>
                    <Input
                      id="order_date"
                      type="date"
                      required
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      data-testid="order-date-input"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      placeholder="Delivery instructions, item preferences…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      data-testid="order-notes-input"
                      className="mt-1.5"
                    />
                  </div>
                  <div className="rounded-md border border-dashed border-border bg-secondary p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items selected</span>
                      <span className="font-mono font-medium" data-testid="summary-lines">{totalLines}</span>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Total quantity</span>
                      <span className="font-mono font-medium" data-testid="summary-qty">{totalQty}</span>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting || !totalLines}
                    className="w-full bg-primary text-primary-foreground hover:bg-[#163820]"
                    data-testid="submit-order-button"
                  >
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Submit order
                  </Button>
                </CardContent>
              </Card>

              <div className="rounded-md border border-dashed border-border bg-secondary/60 p-4 text-xs text-muted-foreground">
                Orders submitted before 10 PM are aggregated into tomorrow’s combined
                purchase sheet for the mandi buyer.
              </div>
            </div>
          </form>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card className="border-border">
            <CardHeader className="border-b border-border">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="font-serif text-xl font-normal">Your order history</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportHistory("xlsx")} className="border-border" data-testid="hotel-export-xlsx">
                    <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> Excel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportHistory("csv")} className="border-border" data-testid="hotel-export-csv">
                    <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportHistory("pdf")} className="border-border" data-testid="hotel-export-pdf">
                    <Download className="mr-1.5 h-4 w-4" strokeWidth={1.5} /> PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table data-testid="hotel-orders-table">
                <TableHeader>
                  <TableRow className="bg-[#F7F5F0]">
                    <TableHead>Order Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Placed</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>
                  ) : null}
                  {orders.map((o) => (
                    <TableRow key={o.id} data-testid={`order-row-${o.id}`}>
                      <TableCell className="font-mono">{o.order_date}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {o.lines.map((ln, idx) => (
                            <Badge key={(ln.item_id || "") + ln.name + idx} variant="outline" className="border-border bg-secondary text-foreground">
                              {ln.name} <span className="ml-1 font-mono text-muted-foreground">· {ln.quantity}{ln.unit}</span>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {o.grand_total > 0 ? (
                          <span className="font-medium" data-testid={`hotel-order-total-${o.id}`}>₹ {o.grand_total.toFixed(2)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground" title="Admin has not set rates yet">Awaiting bill</span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`hotel-bill-menu-${o.id}`} title="Download bill">
                                <Receipt className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                                Download bill
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => downloadBill(o.id, "inventory")} data-testid={`hotel-bill-inventory-${o.id}`}>
                                <FileText className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>Inventory bill</span>
                                  <span className="text-[11px] text-muted-foreground">Items & quantity only</span>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => downloadBill(o.id, "invoice")} disabled={!o.grand_total} data-testid={`hotel-bill-invoice-${o.id}`}>
                                <Receipt className="mr-2 h-4 w-4" />
                                <div className="flex flex-col">
                                  <span>Invoice bill</span>
                                  <span className="text-[11px] text-muted-foreground">{o.grand_total ? `With prices · ₹ ${o.grand_total.toFixed(2)}` : "Awaiting bill"}</span>
                                </div>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {o.status === "pending" ? (
                            <Button variant="ghost" size="sm" onClick={() => cancelOrder(o.id)} data-testid={`cancel-order-${o.id}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
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
