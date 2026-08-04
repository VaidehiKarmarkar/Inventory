import { useState } from "react";
import {
  useListOrders,
  getListOrdersQueryKey,
  type Order,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Download, Eye, ShoppingCart, Calendar, ChevronLeft, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Orders() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState("all");
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // Quick Payment Modal State
  const [payTargetOrder, setPayTargetOrder] = useState<Order | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI">("Cash");
  const [paymentRemarks, setPaymentRemarks] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const limit = 10;
  const { data, isLoading } = useListOrders(
    {
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit,
    },
    {
      query: {
        queryKey: getListOrdersQueryKey({ search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit }),
      },
    }
  );

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();

    if (preset === "this-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(firstDay.toISOString().split("T")[0]);
      setDateTo(lastDay.toISOString().split("T")[0]);
    } else if (preset === "previous-month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(firstDay.toISOString().split("T")[0]);
      setDateTo(lastDay.toISOString().split("T")[0]);
    } else if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === "all") {
      setDateFrom("");
      setDateTo("");
    }
  };

  const handleDownload = async (orderId: number, invoiceNumber: string) => {
    setDownloadingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to download invoice", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const openQuickPaymentModal = (order: Order) => {
    setPayTargetOrder(order);
    setPaymentAmount(order.pendingAmount ? order.pendingAmount.toString() : "");
    setPaymentMethod("Cash");
    setPaymentRemarks("");
  };

  const handleRecordPaymentSubmit = async () => {
    if (!payTargetOrder) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }
    if (!paymentRemarks.trim()) {
      toast({
        title: "Remarks are mandatory",
        description: "Please enter a payment note or remark before saving.",
        variant: "destructive",
      });
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await fetch(`/api/orders/${payTargetOrder.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount: amt,
          paymentMethod,
          remarks: paymentRemarks.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to record payment");
      }

      toast({ title: `Payment recorded for ${payTargetOrder.invoiceNumber}` });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setPayTargetOrder(null);
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Failed to record payment", variant: "destructive" });
    } finally {
      setRecordingPayment(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / 15) : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Manage sales orders and track pending payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="gap-2 cursor-pointer">
            <a href="/api/dashboard/export/orders" download>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </a>
          </Button>
          <Link href="/orders/new">
            <Button data-testid="button-create-order">
              <Plus className="w-4 h-4 mr-2" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Popover open={searchDropdownOpen && Boolean(search.trim()) && Boolean(data?.data?.length)} onOpenChange={setSearchDropdownOpen}>
            <PopoverTrigger asChild>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Input
                  placeholder="Search invoice no, customer name or mobile..."
                  className="pl-9"
                  value={search}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                    setSearchDropdownOpen(true);
                  }}
                  data-testid="input-search-orders"
                />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] sm:w-[380px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              <Command>
                <CommandList className="max-h-[240px] overflow-y-auto">
                  <CommandEmpty>No matching orders found.</CommandEmpty>
                  <CommandGroup heading="Matching Orders">
                    {data?.data?.map((o) => (
                      <CommandItem
                        key={o.id}
                        value={o.invoiceNumber + " " + o.customerName + " " + o.customerMobile}
                        onSelect={() => {
                          setSearch(o.invoiceNumber);
                          setSearchDropdownOpen(false);
                        }}
                        className="flex items-center justify-between py-2 px-3 cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-xs text-primary">{o.invoiceNumber}</span>
                          <span className="text-xs font-semibold text-foreground">{o.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold">{formatCurrency(o.grandTotal)}</span>
                          <Badge variant={o.pendingAmount > 0 ? "secondary" : "outline"} className="text-[10px]">
                            {o.pendingAmount > 0 ? "Pending" : "Paid"}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Filter Dropdown with Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={datePreset} onValueChange={handleDatePresetChange}>
            <SelectTrigger className="w-44 h-10 text-xs font-semibold" data-testid="select-date-preset">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <SelectValue placeholder="Quick Date Filter" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📅 All Time</SelectItem>
              <SelectItem value="this-month">🗓️ This Month</SelectItem>
              <SelectItem value="previous-month">📆 Previous Month</SelectItem>
              <SelectItem value="today">☀️ Today</SelectItem>
              <SelectItem value="custom">✏️ Custom Range</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); setPage(1); }}
            className="w-36 h-10 text-xs"
          />
          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); setPage(1); }}
            className="w-36 h-10 text-xs"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <ShoppingCart className="w-12 h-12 opacity-30" />
              <p>No orders found.</p>
              <Link href="/orders/new">
                <Button variant="outline">Create your first order</Button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Invoice No.</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Subtotal</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">GST</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total & Paid</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Payment Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Created By</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((order) => (
                  <tr key={order.id} className={`hover:bg-muted/30 transition-colors ${order.pendingAmount > 0 ? "bg-amber-500/[0.02]" : ""}`} data-testid={`row-order-${order.id}`}>
                    <td className="px-6 py-3">
                      <Link href={`/orders/${order.id}`}>
                        <span className="font-mono text-xs font-bold text-primary hover:underline cursor-pointer">{order.invoiceNumber}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerMobile}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{formatCurrency(order.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{formatCurrency(order.gstAmount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div>
                        <p className="font-bold">{formatCurrency(order.grandTotal)}</p>
                        <p className="text-[11px] text-muted-foreground">Paid: {formatCurrency(order.paidAmount)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {order.pendingAmount > 0 ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold px-2.5 py-0.5 rounded-full text-xs animate-pulse">
                          Pending: {formatCurrency(order.pendingAmount)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium px-2.5 py-0.5 rounded-full text-xs">
                          Fully Paid
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(String(order.createdAt))}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{order.createdByName ?? "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {order.pendingAmount > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-bold px-2 cursor-pointer"
                            title="Record Payment"
                            onClick={() => openQuickPaymentModal(order)}
                            data-testid={`button-record-pay-row-${order.id}`}
                          >
                            <Plus className="w-3 h-3 mr-1" /> Pay
                          </Button>
                        )}
                        <Link href={`/orders/${order.id}`}>
                          <Button size="icon" variant="ghost" data-testid={`button-view-order-${order.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={downloadingId === order.id}
                          onClick={() => handleDownload(order.id, order.invoiceNumber)}
                          data-testid={`button-download-order-${order.id}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Clickable Page Numbers Pagination */}
      {data && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground pt-2">
          <span>Showing {data.total > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, data.total)} of {data.total} orders</span>
          
          <div className="flex items-center gap-1.5" data-testid="orders-pagination-numbers">
            <span className="text-xs font-semibold mr-1">Pages:</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {Array.from({ length: Math.max(1, Math.ceil(data.total / limit)) }, (_, i) => i + 1).map((pNum) => (
              <Button
                key={pNum}
                variant={page === pNum ? "default" : "outline"}
                size="sm"
                className={`h-8 min-w-8 px-2 text-xs font-extrabold cursor-pointer transition-all ${
                  page === pNum ? "shadow-sm bg-primary text-primary-foreground font-bold" : "hover:bg-accent"
                }`}
                onClick={() => setPage(pNum)}
                data-testid={`button-orders-page-${pNum}`}
              >
                {pNum}
              </Button>
            ))}

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 cursor-pointer"
              disabled={page >= Math.max(1, Math.ceil(data.total / limit))}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Quick Record Payment Dialog */}
      <Dialog open={!!payTargetOrder} onOpenChange={(open) => { if (!open) setPayTargetOrder(null); }}>
        {payTargetOrder && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment for {payTargetOrder.invoiceNumber}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs">
                <span className="font-semibold text-amber-700 dark:text-amber-300">Pending Balance</span>
                <span className="font-bold text-sm text-amber-600 dark:text-amber-400">{formatCurrency(payTargetOrder.pendingAmount)}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quickPayAmount" className="text-xs font-semibold">Payment Amount (₹) <span className="text-destructive">*</span></Label>
                <Input
                  id="quickPayAmount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Payment Method <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("Cash")}
                    className={`flex-1 py-2 text-xs font-bold rounded-md border transition-all cursor-pointer ${paymentMethod === "Cash" ? "bg-primary text-primary-foreground border-primary shadow-xs" : "bg-background text-muted-foreground hover:text-foreground"}`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("UPI")}
                    className={`flex-1 py-2 text-xs font-bold rounded-md border transition-all cursor-pointer ${paymentMethod === "UPI" ? "bg-primary text-primary-foreground border-primary shadow-xs" : "bg-background text-muted-foreground hover:text-foreground"}`}
                  >
                    📱 UPI
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quickPayRemarks" className="text-xs font-semibold flex items-center gap-1">
                  <span>Remarks / Payment Note</span>
                  <span className="text-destructive font-bold">* (Mandatory)</span>
                </Label>
                <Textarea
                  id="quickPayRemarks"
                  rows={3}
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="Required: e.g. Received GPay payment transaction #98765 or Cash received..."
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setPayTargetOrder(null)} type="button">Cancel</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                onClick={handleRecordPaymentSubmit}
                disabled={recordingPayment || !paymentRemarks.trim()}
                data-testid="button-submit-quick-payment"
              >
                {recordingPayment ? "Saving..." : "Save Payment Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
