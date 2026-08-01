import { useState } from "react";
import {
  useListInventory,
  useAdjustInventory,
  useListProducts,
  getListInventoryQueryKey,
  getListProductsQueryKey,
  type InventoryAdjustInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, History, ArrowUpCircle, ArrowDownCircle, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const adjustSchema = z.object({
  productId: z.coerce.number().min(1, "Select a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  actionType: z.enum(["add", "reduce"]),
});
type AdjustForm = z.infer<typeof adjustSchema>;

const actionTypeConfig = {
  add: { label: "Stock Added", color: "text-green-600", icon: ArrowUpCircle, badgeVariant: "outline" as const },
  reduce: { label: "Stock Reduced", color: "text-orange-600", icon: ArrowDownCircle, badgeVariant: "secondary" as const },
  order: { label: "Order Fulfilled", color: "text-primary", icon: ShoppingCart, badgeVariant: "default" as const },
};

export default function Inventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListInventory(
    { productId: productFilter, page, limit: 20 },
    { query: { queryKey: getListInventoryQueryKey({ productId: productFilter, page, limit: 20 }) } }
  );

  const { data: productsData } = useListProducts(
    { limit: 100 },
    { query: { queryKey: getListProductsQueryKey({ limit: 100 }) } }
  );

  const adjustInventory = useAdjustInventory();

  const form = useForm<AdjustForm>({
    resolver: zodResolver(adjustSchema),
    defaultValues: { productId: 0, quantity: 1, actionType: "add" },
  });

  const onSubmit = (values: AdjustForm) => {
    adjustInventory.mutate(
      { data: values as InventoryAdjustInput },
      {
        onSuccess: () => {
          toast({ title: "Inventory adjusted successfully" });
          setDialogOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = (err as { data?: { error?: string } })?.data?.error || "Failed to adjust inventory";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Log</h1>
          <p className="text-muted-foreground mt-1">Track all stock movements and adjustments.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-adjust-inventory">
          <Plus className="w-4 h-4 mr-2" /> Adjust Stock
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={productFilter ? String(productFilter) : "all"}
          onValueChange={(v) => { setProductFilter(v === "all" ? undefined : Number(v)); setPage(1); }}
        >
          <SelectTrigger className="w-56" data-testid="select-product-filter">
            <SelectValue placeholder="All Products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Products</SelectItem>
            {productsData?.data?.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <History className="w-12 h-12 opacity-30" />
              <p>No inventory transactions yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">CRYSTAL TYPE</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Previous</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Change</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Current</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Updated By</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((txn) => {
                  const cfg = actionTypeConfig[txn.actionType as keyof typeof actionTypeConfig];
                  const Icon = cfg?.icon ?? History;
                  const change = txn.quantityAdded ?? (txn.quantityReduced ? -txn.quantityReduced : 0);
                  return (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-inventory-${txn.id}`}>
                      <td className="px-6 py-3 font-medium">{txn.productName}</td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center gap-1.5 ${cfg?.color ?? "text-muted-foreground"}`}>
                          <Icon className="w-4 h-4" />
                          <span className="text-xs font-medium">{cfg?.label ?? txn.actionType}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{txn.previousQuantity}</td>
                      <td className={`px-4 py-3 text-right font-medium ${change > 0 ? "text-green-600" : "text-orange-600"}`}>
                        {change > 0 ? `+${change}` : change}
                      </td>
                      <td className="px-4 py-3 text-right font-bold">{txn.currentQuantity}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{txn.updatedByName ?? "System"}</td>
                      <td className="px-6 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(String(txn.updatedAt))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data && data.total > 20 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data.total)} of {data.total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Inventory</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="productId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select value={String(field.value || "")} onValueChange={(v) => field.onChange(Number(v))}>
                    <FormControl>
                      <SelectTrigger data-testid="select-inventory-product">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productsData?.data?.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.availableQuantity} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="actionType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="add">Add Stock</SelectItem>
                      <SelectItem value="reduce">Reduce Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} data-testid="input-inventory-quantity" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adjustInventory.isPending}>Adjust</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
