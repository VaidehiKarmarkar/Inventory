import { useState } from "react";
import {
  useListProducts,
  useCreateOrder,
  getListOrdersQueryKey,
  getListProductsQueryKey,
  type OrderInput,
  type Order,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ArrowLeft, ShoppingCart, ChevronsUpDown, Check, Printer, Download, Eye, Edit3, CheckCircle2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface OrderLineItem {
  productId: number;
  productName: string;
  price: number;
  quantity: number;
  availableQuantity: number;
}

export default function NewOrder() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [gstPercentage, setGstPercentage] = useState(0);
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productComboOpen, setProductComboOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [customPaidAmount, setCustomPaidAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI">("Cash");

  // Confirmation screen state
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { data: productsData } = useListProducts(
    { limit: 100 },
    { query: { queryKey: getListProductsQueryKey({ limit: 100 }) } }
  );

  const createOrder = useCreateOrder();

  const selectedProduct = productsData?.data?.find(p => p.id === selectedProductId);

  const addItem = () => {
    if (!selectedProductId || !selectedProduct) {
      toast({ title: "Please select a product", variant: "destructive" });
      return;
    }
    if (quantity < 1) {
      toast({ title: "Quantity must be at least 1", variant: "destructive" });
      return;
    }
    const existing = items.findIndex(i => i.productId === selectedProductId);
    const newQty = existing >= 0 ? items[existing].quantity + quantity : quantity;
    if (newQty > selectedProduct.availableQuantity) {
      toast({ title: `Only ${selectedProduct.availableQuantity} units available`, variant: "destructive" });
      return;
    }
    if (existing >= 0) {
      setItems(prev => prev.map((item, idx) =>
        idx === existing ? { ...item, quantity: newQty } : item
      ));
    } else {
      setItems(prev => [...prev, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        price: selectedProduct.price,
        quantity,
        availableQuantity: selectedProduct.availableQuantity,
      }]);
    }
    setSelectedProductId(null);
    setQuantity(1);
  };

  const removeItem = (productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateItemQuantity = (productId: number, rawVal: string) => {
    const product = items.find(i => i.productId === productId);
    if (!product) return;
    if (rawVal === "") {
      setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: 0 } : i));
      return;
    }
    const qty = parseInt(rawVal, 10);
    if (isNaN(qty)) return;
    if (qty > product.availableQuantity) {
      toast({ title: `Only ${product.availableQuantity} units available`, variant: "destructive" });
      setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: product.availableQuantity } : i));
      return;
    }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, qty) } : i));
  };

  const handleItemQuantityBlur = (productId: number) => {
    setItems(prev => prev.map(i => {
      if (i.productId === productId && i.quantity < 1) {
        return { ...i, quantity: 1 };
      }
      return i;
    }));
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerMobile("");
    setCustomerEmail("");
    setCustomerAddress("");
    setOrderDate(new Date().toISOString().split("T")[0]);
    setGstPercentage(0);
    setItems([]);
    setSelectedProductId(null);
    setQuantity(1);
    setDiscountPercentage(0);
    setCustomPaidAmount("");
    setPaymentMethod("Cash");
    setCreatedOrder(null);
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discNum = (subtotal * discountPercentage) / 100;
  const subtotalAfterDisc = Math.max(0, subtotal - discNum);
  const gstAmount = subtotalAfterDisc * (gstPercentage / 100);
  const grandTotal = subtotalAfterDisc + gstAmount;

  const handleSubmit = (andPrint = false) => {
    if (!customerName.trim()) {
      toast({ title: "Please enter customer name", variant: "destructive" });
      return;
    }
    if (!customerMobile.trim()) {
      toast({ title: "Please enter customer mobile", variant: "destructive" });
      return;
    }
    const mobileRegex = /^[6789]\d{9}$/;
    if (!mobileRegex.test(customerMobile.trim())) {
      toast({
        title: "Invalid Mobile Number",
        description: "Mobile number must be 10 digits and start with 6, 7, 8, or 9",
        variant: "destructive",
      });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }
    if (items.some(i => i.quantity < 1)) {
      toast({ title: "Please enter a valid quantity for all items", variant: "destructive" });
      return;
    }

    const payload: OrderInput = {
      customerName: customerName.trim(),
      customerMobile: customerMobile.trim(),
      customerEmail: customerEmail.trim() || undefined,
      customerAddress: customerAddress.trim() || undefined,
      gstPercentage,
      discount: discNum,
      paidAmount: customPaidAmount !== "" ? Number(customPaidAmount) : undefined,
      paymentMethod,
      createdAt: orderDate ? `${orderDate}T12:00:00.000Z` : undefined,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.price,
      })),
    };

    createOrder.mutate(
      { data: payload },
      {
        onSuccess: async (order) => {
          toast({ title: `Order ${order.invoiceNumber} created!` });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setCreatedOrder(order);

          if (andPrint) {
            try {
              const res = await fetch(`/api/orders/${order.id}/invoice`, { credentials: "include" });
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const printWin = window.open(url, "_blank");
                if (printWin) {
                  printWin.focus();
                }
              }
            } catch (e) {
              console.error("Failed to print invoice:", e);
            }
          }
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error || "Failed to create order";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handlePrint = async (orderId: number) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, "_blank");
      if (printWin) printWin.focus();
    } catch {
      toast({ title: "Failed to open print window", variant: "destructive" });
    }
  };

  const handleDownload = async (orderId: number, invoiceNumber: string) => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`, { credentials: "include" });
      if (!res.ok) throw new Error();
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
      setDownloading(false);
    }
  };

  // If order was created, render the Order Confirmation & Summary Screen with Edit option
  if (createdOrder) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
        <Card className="border-emerald-500/30 bg-emerald-500/[0.02]">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              Order Created & Invoice Generated!
            </CardTitle>
            <p className="text-muted-foreground text-sm font-mono mt-1">{createdOrder.invoiceNumber}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-muted/40 p-4 rounded-xl border">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase">Customer</p>
                <p className="font-bold text-base mt-0.5">{createdOrder.customerName}</p>
                <p className="text-xs text-muted-foreground">{createdOrder.customerMobile}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-muted-foreground uppercase">Grand Total & Status</p>
                <p className="font-extrabold text-lg text-primary mt-0.5">{formatCurrency(createdOrder.grandTotal)}</p>
                <Badge variant={createdOrder.pendingAmount > 0 ? "outline" : "default"} className={createdOrder.pendingAmount > 0 ? "bg-amber-500/10 text-amber-600 border-amber-500/30" : "bg-emerald-600"}>
                  {createdOrder.pendingAmount > 0 ? `Pending: ${formatCurrency(createdOrder.pendingAmount)}` : "Fully Paid"}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                className="border-primary/40 text-primary font-bold hover:bg-primary/5 cursor-pointer"
                onClick={() => setCreatedOrder(null)}
                data-testid="button-edit-summary-order"
              >
                <Edit3 className="w-4 h-4 mr-2" /> Edit Order
              </Button>

              <Button
                variant="outline"
                className="font-bold cursor-pointer"
                onClick={() => handlePrint(createdOrder.id)}
                data-testid="button-print-summary-order"
              >
                <Printer className="w-4 h-4 mr-2" /> Print Invoice
              </Button>

              <Button
                variant="outline"
                disabled={downloading}
                onClick={() => handleDownload(createdOrder.id, createdOrder.invoiceNumber)}
                data-testid="button-download-summary-order"
              >
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </Button>

              <Button
                onClick={() => setLocation(`/orders/${createdOrder.id}`)}
                data-testid="button-view-summary-order"
              >
                <Eye className="w-4 h-4 mr-2" /> View Order Details
              </Button>

              <Button
                variant="secondary"
                onClick={resetForm}
                data-testid="button-create-another-order"
              >
                <Plus className="w-4 h-4 mr-2" /> Create Another Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/orders">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Order</h1>
          <p className="text-muted-foreground mt-1">Create a new sales invoice.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="customerName"
                    placeholder="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerMobile">Mobile <span className="text-destructive">*</span></Label>
                  <Input
                    id="customerMobile"
                    placeholder="10-digit mobile (starts with 6-9)"
                    maxLength={10}
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">Email <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="email@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerAddress">Address <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="customerAddress"
                    placeholder="Billing address"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderDate" className="flex items-center gap-1.5 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Order Date</span>
                  </Label>
                  <Input
                    id="orderDate"
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="bg-background"
                    data-testid="input-order-date"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Crystal Types</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Popover open={productComboOpen} onOpenChange={setProductComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={productComboOpen}
                        className="w-full justify-between font-normal text-left h-10 border-input bg-background"
                        data-testid="select-order-product"
                      >
                        {selectedProductId ? (
                          (() => {
                            const p = productsData?.data?.find((prod) => prod.id === selectedProductId);
                            return p ? (
                              <span className="flex items-center gap-2 truncate">
                                <span className="font-semibold text-foreground">{p.name}</span>
                                <span className="text-muted-foreground text-xs font-mono">
                                  ({formatCurrency(p.price)} · {p.availableQuantity} avail)
                                </span>
                              </span>
                            ) : "Choose Crystal Type...";
                          })()
                        ) : (
                          <span className="text-muted-foreground">Choose or search Crystal Type...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] sm:w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search Crystal Type by name..." />
                        <CommandList className="max-h-[260px] overflow-y-auto">
                          <CommandEmpty>No matching crystal type found.</CommandEmpty>
                          <CommandGroup heading="Available Crystal Types">
                            {productsData?.data
                              ?.filter(p => p.availableQuantity > 0)
                              .map(p => (
                                <CommandItem
                                  key={p.id}
                                  value={p.name}
                                  onSelect={() => {
                                    setSelectedProductId(p.id);
                                    setProductComboOpen(false);
                                  }}
                                  className="flex items-center justify-between py-2 px-3 cursor-pointer"
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-sm">{p.name}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{formatCurrency(p.price)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      {p.availableQuantity} avail
                                    </span>
                                    {selectedProductId === p.id && <Check className="w-4 h-4 text-primary ml-1" />}
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-20"
                  data-testid="input-order-quantity"
                />
                <Button type="button" onClick={addItem} data-testid="button-add-item">
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              {items.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">CRYSTAL TYPE</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Unit Price</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Qty</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total</th>
                        <th className="px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((item) => (
                        <tr key={item.productId} data-testid={`row-order-item-${item.productId}`}>
                          <td className="px-4 py-2 font-medium">{item.productName}</td>
                          <td className="px-4 py-2 text-right text-muted-foreground">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-2 text-right">
                            <Input
                              type="number"
                              min={1}
                              max={item.availableQuantity}
                              value={item.quantity === 0 ? "" : item.quantity}
                              onChange={(e) => updateItemQuantity(item.productId, e.target.value)}
                              onBlur={() => handleItemQuantityBlur(item.productId)}
                              className="w-16 h-7 text-right text-xs ml-auto"
                            />
                          </td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.price * item.quantity)}</td>
                          <td className="px-2 py-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border border-dashed rounded-md py-10 flex flex-col items-center text-muted-foreground gap-2">
                  <ShoppingCart className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No items added yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <Label htmlFor="discountSelect" className="text-xs text-muted-foreground font-medium">Discount (%)</Label>
                  <Select
                    value={String(discountPercentage)}
                    onValueChange={(v) => setDiscountPercentage(Number(v))}
                  >
                    <SelectTrigger id="discountSelect" className="h-7 w-24 text-xs px-2" data-testid="select-discount">
                      <SelectValue placeholder="Select Discount" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="1">1%</SelectItem>
                      <SelectItem value="2">2%</SelectItem>
                      <SelectItem value="3">3%</SelectItem>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {discNum > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>Discount Applied ({discountPercentage}%)</span>
                    <span>-{formatCurrency(discNum)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>GST</span>
                    <div className="flex items-center gap-1">
                      <Select
                        value={String(gstPercentage)}
                        onValueChange={(v) => setGstPercentage(Number(v))}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs px-2" data-testid="select-gst">
                          <SelectValue placeholder="Select GST" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="1">1%</SelectItem>
                          <SelectItem value="18">18%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="paidAmount" className="text-xs font-semibold text-foreground/80">Amount Paid (₹)</Label>
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("Cash")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${paymentMethod === "Cash" ? "bg-background text-primary shadow-xs border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
                      data-testid="button-pay-cash"
                    >
                      💵 Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("UPI")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${paymentMethod === "UPI" ? "bg-background text-primary shadow-xs border border-border/50" : "text-muted-foreground hover:text-foreground"}`}
                      data-testid="button-pay-upi"
                    >
                      📱 UPI
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="paidAmount"
                    type="number"
                    min={0}
                    max={grandTotal}
                    step={0.01}
                    placeholder={grandTotal.toFixed(2)}
                    value={customPaidAmount}
                    onChange={(e) => setCustomPaidAmount(e.target.value)}
                    className="h-9 w-full text-sm font-semibold"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomPaidAmount("")}
                    className="h-9 text-xs px-2 shrink-0 cursor-pointer"
                    disabled={customPaidAmount === ""}
                  >
                    Reset
                  </Button>
                </div>
                {customPaidAmount !== "" && (
                  <div className="flex justify-between items-center text-xs mt-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                    <span>Pending Balance</span>
                    <span className="font-bold text-sm">{formatCurrency(Math.max(0, grandTotal - Number(customPaidAmount)))}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="text-xs text-muted-foreground">
                <p>{items.length} item type{items.length !== 1 ? "s" : ""}</p>
                <p>{items.reduce((s, i) => s + i.quantity, 0)} total units</p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full font-bold shadow-sm"
                  onClick={() => handleSubmit(false)}
                  disabled={createOrder.isPending || !customerName.trim() || !customerMobile.trim() || items.length === 0}
                  data-testid="button-submit-order"
                >
                  {createOrder.isPending ? "Creating..." : "Create Order"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full border-primary/40 text-primary hover:bg-primary/5 font-bold shadow-xs"
                  onClick={() => handleSubmit(true)}
                  disabled={createOrder.isPending || !customerName.trim() || !customerMobile.trim() || items.length === 0}
                  data-testid="button-submit-and-print-order"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {createOrder.isPending ? "Creating..." : "Create & Print Invoice"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
