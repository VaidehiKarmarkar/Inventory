import { useState } from "react";
import {
  useListCustomers,
  useListProducts,
  useCreateOrder,
  getListOrdersQueryKey,
  getListCustomersQueryKey,
  getListProductsQueryKey,
  type OrderInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, ArrowLeft, ShoppingCart } from "lucide-react";
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

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [gstPercentage, setGstPercentage] = useState(18);
  const [items, setItems] = useState<OrderLineItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: customersData } = useListCustomers(
    { limit: 100 },
    { query: { queryKey: getListCustomersQueryKey({ limit: 100 }) } }
  );
  const { data: productsData } = useListProducts(
    { limit: 100 },
    { query: { queryKey: getListProductsQueryKey({ limit: 100 }) } }
  );

  const createOrder = useCreateOrder();

  const filteredCustomers = customersData?.data?.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.mobile.includes(customerSearch)
  ) ?? [];

  const selectedCustomer = customersData?.data?.find(c => c.id === customerId);
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

  const updateItemQuantity = (productId: number, qty: number) => {
    const product = items.find(i => i.productId === productId);
    if (!product) return;
    if (qty < 1) { removeItem(productId); return; }
    if (qty > product.availableQuantity) {
      toast({ title: `Only ${product.availableQuantity} units available`, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const gstAmount = subtotal * (gstPercentage / 100);
  const grandTotal = subtotal + gstAmount;

  const handleSubmit = () => {
    if (!customerId || !selectedCustomer) {
      toast({ title: "Please select a customer", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" });
      return;
    }

    const payload: OrderInput = {
      customerId,
      customerName: selectedCustomer.name,
      customerMobile: selectedCustomer.mobile,
      customerEmail: selectedCustomer.email ?? undefined,
      customerAddress: selectedCustomer.address ?? undefined,
      gstPercentage,
      items: items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.price,
      })),
    };

    createOrder.mutate(
      { data: payload },
      {
        onSuccess: (order) => {
          toast({ title: `Order ${order.invoiceNumber} created!` });
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setLocation(`/orders/${order.id}`);
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error || "Failed to create order";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

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
              <CardTitle className="text-base">Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Search by name or mobile..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                data-testid="input-customer-search"
              />
              <Select
                value={customerId ? String(customerId) : ""}
                onValueChange={(v) => setCustomerId(Number(v))}
              >
                <SelectTrigger data-testid="select-order-customer">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCustomers.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.mobile}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCustomer && (
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3 space-y-1">
                  {selectedCustomer.email && <p><span className="font-medium">Email:</span> {selectedCustomer.email}</p>}
                  {selectedCustomer.address && <p><span className="font-medium">Address:</span> {selectedCustomer.address}</p>}
                  {selectedCustomer.gstNumber && <p><span className="font-medium">GST:</span> {selectedCustomer.gstNumber}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add Products</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select
                    value={selectedProductId ? String(selectedProductId) : ""}
                    onValueChange={(v) => setSelectedProductId(Number(v))}
                  >
                    <SelectTrigger data-testid="select-order-product">
                      <SelectValue placeholder="Choose product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {productsData?.data
                        ?.filter(p => p.availableQuantity > 0)
                        .map(p => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            <span>{p.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">
                              {formatCurrency(p.price)} · {p.availableQuantity} avail.
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
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
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
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
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.productId, Number(e.target.value))}
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
                  <div className="flex items-center gap-2">
                    <span>GST</span>
                    <Select
                      value={String(gstPercentage)}
                      onValueChange={(v) => setGstPercentage(Number(v))}
                    >
                      <SelectTrigger className="h-6 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span>{formatCurrency(gstAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>{items.length} item type{items.length !== 1 ? "s" : ""}</p>
                <p>{items.reduce((s, i) => s + i.quantity, 0)} total units</p>
              </div>

              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createOrder.isPending || !customerId || items.length === 0}
                data-testid="button-submit-order"
              >
                {createOrder.isPending ? "Creating..." : "Create Order & Invoice"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
