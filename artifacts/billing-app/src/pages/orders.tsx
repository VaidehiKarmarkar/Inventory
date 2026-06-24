import { useState } from "react";
import {
  useListOrders,
  getListOrdersQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Download, Eye, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Orders() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data, isLoading } = useListOrders(
    {
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      limit: 15,
    },
    {
      query: {
        queryKey: getListOrdersQueryKey({ search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit: 15 }),
      },
    }
  );

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order History</h1>
          <p className="text-muted-foreground mt-1">View and manage all invoices.</p>
        </div>
        <Link href="/orders/new">
          <Button data-testid="button-new-order">
            <Plus className="w-4 h-4 mr-2" /> New Order
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or invoice no..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-search-orders"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">From:</label>
          <Input type="date" className="w-36" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">To:</label>
          <Input type="date" className="w-36" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
        </div>
        {(dateFrom || dateTo || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setPage(1); }}>
            Clear
          </Button>
        )}
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
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Created By</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-order-${order.id}`}>
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs font-medium text-primary">{order.invoiceNumber}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerMobile}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{formatCurrency(order.subtotal)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{formatCurrency(order.gstAmount)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(order.grandTotal)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(String(order.createdAt))}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{order.createdByName ?? "—"}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
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

      {data && data.total > 15 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * 15 + 1}–{Math.min(page * 15, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 15 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
