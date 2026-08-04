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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Plus, History, ArrowUpCircle, ArrowDownCircle, ShoppingCart, ChevronLeft, ChevronRight, Search, ChevronsUpDown, Check, X, Package, FileSpreadsheet } from "lucide-react";
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
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);

  const limit = 10;
  const { data, isLoading } = useListInventory(
    { productId: productFilter, search: search || undefined, page, limit },
    { query: { queryKey: getListInventoryQueryKey({ productId: productFilter, search: search || undefined, page, limit }) } }
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

  const selectedProductFilterName = productsData?.data?.find(p => p.id === productFilter)?.name;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory Log</h1>
          <p className="text-muted-foreground mt-1">Track all stock movements and adjustments.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild className="gap-2 cursor-pointer">
            <a href="/api/dashboard/export/inventory" download>
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Excel</span>
            </a>
          </Button>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-adjust-inventory">
            <Plus className="w-4 h-4 mr-2" /> Adjust Stock
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Instant Search Bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            placeholder="Smart Search Crystal Type in Log..."
            className="pl-9 pr-8"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            data-testid="input-search-inventory"
          />
          {search && (
            <span
              onClick={() => { setSearch(""); setPage(1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer z-10"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        {/* Quick Select Product Dropdown Popover */}
        <Popover open={searchDropdownOpen} onOpenChange={setSearchDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={searchDropdownOpen}
              className="w-full sm:w-64 justify-between font-normal text-muted-foreground bg-background hover:bg-accent/50 shadow-xs h-10 px-3"
              data-testid="button-filter-inventory-combobox"
            >
              <div className="flex items-center gap-2 truncate">
                <Package className="w-4 h-4 shrink-0 opacity-50 text-primary" />
                <span className={productFilter ? "text-foreground font-semibold truncate" : "truncate"}>
                  {selectedProductFilterName || "All Products Filter"}
                </span>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search crystal type..." />
              <CommandList className="max-h-[260px] overflow-y-auto">
                <CommandEmpty>No matching crystal type found.</CommandEmpty>
                <CommandGroup heading="Filter by Crystal Type">
                  <CommandItem
                    value="--all-products--"
                    onSelect={() => {
                      setProductFilter(undefined);
                      setPage(1);
                      setSearchDropdownOpen(false);
                    }}
                    className="text-xs font-bold py-2 px-3 cursor-pointer border-b"
                  >
                    <span className="flex items-center justify-between w-full">
                      <span>All Products</span>
                      {!productFilter && <Check className="w-3.5 h-3.5 text-primary" />}
                    </span>
                  </CommandItem>
                  {productsData?.data?.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.name}
                      onSelect={() => {
                        setProductFilter(p.id);
                        setPage(1);
                        setSearchDropdownOpen(false);
                      }}
                      className="flex items-center justify-between py-2 px-3 cursor-pointer"
                    >
                      <span className="font-semibold text-xs text-foreground truncate">{p.name}</span>
                      {productFilter === p.id && <Check className="w-3.5 h-3.5 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
              <p>No inventory transactions found.</p>
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

      {/* Clickable Page Numbers Pagination */}
      {data && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground pt-2">
          <span>Showing {data.total > 0 ? (page - 1) * limit + 1 : 0}–{Math.min(page * limit, data.total)} of {data.total} items</span>
          
          <div className="flex items-center gap-1.5" data-testid="inventory-pagination-numbers">
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
                data-testid={`button-inventory-page-${pNum}`}
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
                  <FormControl><Input type="number" min={1} {...field} data-testid="input-adjust-quantity" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={adjustInventory.isPending} data-testid="button-submit-adjust">
                  {adjustInventory.isPending ? "Saving..." : "Save Adjustment"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
