import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetOrder, getGetOrderQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Download, Printer, Phone, Mail, MapPin, Plus, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const id = Number(params?.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [downloading, setDownloading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI">("Cash");
  const [paymentRemarks, setPaymentRemarks] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  const { data: order, isLoading, error } = useGetOrder(id);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/orders/${id}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${order?.invoiceNumber ?? "invoice"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to download invoice", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    try {
      const res = await fetch(`/api/orders/${id}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, "_blank");
      if (printWin) {
        printWin.focus();
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${order?.invoiceNumber ?? "invoice"}.pdf`;
        a.click();
      }
    } catch {
      toast({ title: "Failed to load print invoice", variant: "destructive" });
    }
  };

  const openPaymentModal = () => {
    setPaymentAmount(order?.pendingAmount ? order.pendingAmount.toString() : "");
    setPaymentMethod("Cash");
    setPaymentRemarks("");
    setPaymentDialogOpen(true);
  };

  const handleRecordPaymentSubmit = async () => {
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
      const res = await fetch(`/api/orders/${id}/payments`, {
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

      toast({ title: "Payment recorded successfully!" });
      queryClient.invalidateQueries({ queryKey: getGetOrderQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      setPaymentDialogOpen(false);
    } catch (err: unknown) {
      toast({ title: (err as Error).message || "Failed to record payment", variant: "destructive" });
    } finally {
      setRecordingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
        <p className="text-lg">Order not found.</p>
        <Link href="/orders">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Orders</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/orders">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-mono">{order.invoiceNumber}</h1>
              {order.pendingAmount > 0 ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold px-2.5 py-0.5 text-xs animate-pulse">
                  PENDING BALANCE: {formatCurrency(order.pendingAmount)}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium px-2 py-0.5 text-xs">
                  FULLY PAID
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">Created {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {order.pendingAmount > 0 && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
              onClick={openPaymentModal}
              data-testid="button-record-payment"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Record Payment
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
            <Printer className="w-4 h-4 mr-2" />
            Print Invoice
          </Button>
          <Button onClick={handleDownload} disabled={downloading} data-testid="button-download-invoice">
            <Download className="w-4 h-4 mr-2" />
            {downloading ? "Downloading..." : "Download PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Bill To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-bold text-lg">{order.customerName}</p>
            {order.customerMobile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span>{order.customerMobile}</span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span>{order.customerAddress}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Order Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice Number</span>
              <span className="font-mono font-medium">{order.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <Badge variant="outline" className="font-semibold text-xs bg-primary/10 text-primary border-primary/20">
                {order.paymentMethod || "Cash"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              {order.pendingAmount > 0 ? (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold uppercase text-xs">
                  Pending Follow-up
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-medium uppercase text-xs">
                  Completed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">CRYSTAL TYPE</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Unit Price</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-6 py-3 font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.items?.map((item, idx) => (
                <tr key={item.id} className="hover:bg-muted/20" data-testid={`row-item-${item.id}`}>
                  <td className="px-6 py-3 text-muted-foreground">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{item.productName}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-6 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t p-6 space-y-2 ml-auto max-w-xs">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.gstAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">GST ({order.gstPercentage}%)</span>
                <span>{formatCurrency(order.gstAmount)}</span>
              </div>
            )}
            {(order.referralCharges ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Referral Charges</span>
                <span>{formatCurrency(order.referralCharges!)}</span>
              </div>
            )}
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-emerald-600 dark:text-emerald-400">-{formatCurrency(order.discount!)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Grand Total</span>
              <span>{formatCurrency(order.grandTotal)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount Paid ({order.paymentMethod || "Cash"})</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(order.paidAmount)}</span>
            </div>
            {order.pendingAmount > 0 && (
              <div className="flex justify-between text-sm p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold animate-pulse">
                <span>Pending Balance</span>
                <span>{formatCurrency(order.pendingAmount)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History & Remarks Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Payment History & Remarks Log
          </CardTitle>
          {order.pendingAmount > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-semibold" onClick={openPaymentModal}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {!order.payments || order.payments.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No payment history transactions logged yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-6 py-2.5 font-medium text-muted-foreground">Date & Time</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Method</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Amount</th>
                  <th className="text-left px-6 py-2.5 font-medium text-muted-foreground">Remarks / Payment Note</th>
                  <th className="text-right px-6 py-2.5 font-medium text-muted-foreground">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 text-xs">
                    <td className="px-6 py-3 font-mono text-muted-foreground whitespace-nowrap">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="outline" className="font-bold text-[10px] uppercase">
                        {p.paymentMethod === "UPI" ? "📱 UPI" : "💵 Cash"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      +{formatCurrency(p.amount)}
                    </td>
                    <td className="px-6 py-3 font-medium text-foreground">
                      {p.remarks}
                    </td>
                    <td className="px-6 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {p.createdByName || "System"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment for {order.invoiceNumber}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs">
              <span className="font-semibold text-amber-700 dark:text-amber-300">Pending Balance</span>
              <span className="font-bold text-sm text-amber-600 dark:text-amber-400">{formatCurrency(order.pendingAmount)}</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payAmount" className="text-xs font-semibold">Payment Amount (₹) <span className="text-destructive">*</span></Label>
              <Input
                id="payAmount"
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
              <Label htmlFor="payRemarks" className="text-xs font-semibold flex items-center gap-1">
                <span>Remarks / Payment Note</span>
                <span className="text-destructive font-bold">* (Mandatory)</span>
              </Label>
              <Textarea
                id="payRemarks"
                rows={3}
                value={paymentRemarks}
                onChange={(e) => setPaymentRemarks(e.target.value)}
                placeholder="Required: e.g. Customer paid via GPay transaction #98765 or Cash received..."
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)} type="button">Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={handleRecordPaymentSubmit}
              disabled={recordingPayment || !paymentRemarks.trim()}
              data-testid="button-submit-payment"
            >
              {recordingPayment ? "Saving..." : "Save Payment Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
