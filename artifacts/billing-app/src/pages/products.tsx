import { useState, useEffect } from "react";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
  type Product,
  type ProductInput,
  type ProductUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Edit, Trash2, Package, ChevronsUpDown, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const productSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Price must be greater than 0"),
  availableQuantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
});

type ProductForm = z.infer<typeof productSchema>;

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { data, isLoading } = useListProducts(
    { search: search || undefined, page, limit: 15 },
    { query: { queryKey: getListProductsQueryKey({ search: search || undefined, page, limit: 15 }) } }
  );

  const { data: allProductsData } = useListProducts(
    { limit: 100 },
    { query: { queryKey: getListProductsQueryKey({ limit: 100 }) } }
  );

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", description: "", price: 0, availableQuantity: 0 },
  });

  useEffect(() => {
    if (dialogOpen) {
      if (editProduct) {
        form.reset({
          name: editProduct.name,
          description: editProduct.description ?? "",
          price: editProduct.price,
          availableQuantity: editProduct.availableQuantity,
        });
      } else {
        form.reset({ name: "", description: "", price: 0, availableQuantity: 0 });
      }
    }
  }, [dialogOpen, editProduct]);

  const openCreate = () => {
    setEditProduct(null);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setDialogOpen(true);
  };

  const onSubmit = (values: ProductForm) => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
    if (editProduct) {
      updateProduct.mutate(
        { id: editProduct.id, data: values as ProductUpdate },
        {
          onSuccess: () => { toast({ title: "Product updated" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Failed to update product", variant: "destructive" }),
        }
      );
    } else {
      createProduct.mutate(
        { data: values as ProductInput },
        {
          onSuccess: () => { toast({ title: "Product created" }); setDialogOpen(false); invalidate(); },
          onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
        }
      );
    }
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteProduct.mutate(
      { id: deleteId },
      {
        onSuccess: () => { toast({ title: "Product deleted" }); setDeleteId(null); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
        onError: () => toast({ title: "Failed to delete product", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage your product catalogue.</p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-product">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Popover open={searchDropdownOpen} onOpenChange={setSearchDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={searchDropdownOpen}
                className="w-full justify-between font-normal text-muted-foreground bg-background hover:bg-accent/50 shadow-xs h-10 px-3"
                data-testid="button-search-products-combobox"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-4 h-4 shrink-0 opacity-50" />
                  <span className={search ? "text-foreground font-medium truncate" : "truncate"}>
                    {search || "Smart Search Crystal Type..."}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {search && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearch("");
                        setPage(1);
                      }}
                      className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ml-1" />
                </div>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] sm:w-[400px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search crystal type name..."
                  onValueChange={(val: string) => {
                    setSearch(val);
                    setPage(1);
                  }}
                />
                <CommandList className="max-h-[260px] overflow-y-auto">
                  <CommandEmpty>No matching crystal types found.</CommandEmpty>
                  <CommandGroup heading="All Crystal Types">
                    {search && (
                      <CommandItem
                        value="--clear-all-search-filter--"
                        onSelect={() => {
                          setSearch("");
                          setPage(1);
                          setSearchDropdownOpen(false);
                        }}
                        className="text-xs text-primary font-semibold py-1.5 px-3 cursor-pointer border-b bg-muted/30"
                      >
                        Show All Products (Clear Search)
                      </CommandItem>
                    )}
                    {allProductsData?.data?.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.name}
                        onSelect={() => {
                          setSearch(p.name);
                          setPage(1);
                          setSearchDropdownOpen(false);
                        }}
                        className="flex items-center justify-between py-2 px-3 cursor-pointer"
                      >
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground truncate">{p.description || "Crystal Type"}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-mono font-bold text-primary">{formatCurrency(p.price)}</span>
                          <Badge variant={p.availableQuantity === 0 ? "destructive" : p.availableQuantity <= 2 ? "secondary" : "outline"} className="text-[10px]">
                            {p.availableQuantity} left
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
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data?.data?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Package className="w-12 h-12 opacity-30" />
              <p>No products found.</p>
              <Button variant="outline" onClick={openCreate}>Add your first product</Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Description</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Stock</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.data.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-product-${p.id}`}>
                    <td className="px-6 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[240px] truncate">{p.description || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={p.availableQuantity === 0 ? "destructive" : p.availableQuantity <= 2 ? "secondary" : "outline"}>
                        {p.availableQuantity === 0 ? "Out of stock" : `${p.availableQuantity} units`}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`button-edit-product-${p.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(p.id)} data-testid={`button-delete-product-${p.id}`}>
                          <Trash2 className="w-4 h-4" />
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditProduct(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-product-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea {...field} rows={2} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (₹)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="availableQuantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {editProduct ? "Save Changes" : "Create Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the product. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
