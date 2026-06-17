import { useAuth } from "@/lib/auth-context";
import {
  useGetAdminDashboard,
  useGetUserDashboard,
  useGetRecentOrders,
  useGetLowStockProducts,
  getGetAdminDashboardQueryKey,
  getGetUserDashboardQueryKey,
  getGetRecentOrdersQueryKey,
  getGetLowStockProductsQueryKey,
} from "@workspace/api-client-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Users,
  Activity,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: any, loading?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { isAdmin } = useAuth();

  const { data: adminData, isLoading: adminLoading } = useGetAdminDashboard({
    query: { queryKey: getGetAdminDashboardQueryKey(), enabled: isAdmin }
  });
  
  const { data: userData, isLoading: userLoading } = useGetUserDashboard({
    query: { queryKey: getGetUserDashboardQueryKey(), enabled: !isAdmin }
  });

  const { data: recentOrders, isLoading: ordersLoading } = useGetRecentOrders({
    query: { queryKey: getGetRecentOrdersQueryKey() }
  });
  const { data: lowStock, isLoading: stockLoading } = useGetLowStockProducts({
    query: { queryKey: getGetLowStockProductsQueryKey() }
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your godown operations.</p>
      </div>

      {isAdmin ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Products" value={formatNumber(adminData?.totalProducts || 0)} icon={Package} loading={adminLoading} />
          <StatCard title="Total Inventory" value={formatNumber(adminData?.totalInventory || 0)} icon={Activity} loading={adminLoading} />
          <StatCard title="Total Orders" value={formatNumber(adminData?.totalOrders || 0)} icon={ShoppingCart} loading={adminLoading} />
          <StatCard title="Today's Sales" value={formatCurrency(adminData?.todaySales || 0)} icon={TrendingUp} loading={adminLoading} />
          <StatCard title="Monthly Sales" value={formatCurrency(adminData?.monthlySales || 0)} icon={TrendingUp} loading={adminLoading} />
          <StatCard title="Out of Stock" value={formatNumber(adminData?.outOfStockCount || 0)} icon={AlertTriangle} loading={adminLoading} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Orders Today" value={formatNumber(userData?.ordersToday || 0)} icon={ShoppingCart} loading={userLoading} />
          <StatCard title="Total Orders" value={formatNumber(userData?.totalOrders || 0)} icon={Activity} loading={userLoading} />
          <StatCard title="Total Revenue Generated" value={formatCurrency(userData?.totalRevenue || 0)} icon={TrendingUp} loading={userLoading} />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Latest transactions in the system.</p>
            </div>
            <Link href="/orders" className="text-sm font-medium text-primary hover:underline flex items-center">
              View All <ArrowRight className="ml-1 w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !recentOrders?.length ? (
              <div className="text-center py-6 text-muted-foreground">No recent orders found.</div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{order.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">{formatCurrency(order.grandTotal)}</p>
                      <Badge variant="outline" className="text-[10px] mt-1 uppercase">{order.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 border-destructive/20 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <CardTitle className="text-destructive">Low Stock Alerts</CardTitle>
            </div>
            {isAdmin && (
              <Link href="/products" className="text-sm font-medium text-primary hover:underline">
                Manage Stock
              </Link>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {stockLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !lowStock?.length ? (
              <div className="text-center py-6 text-muted-foreground">All products are adequately stocked.</div>
            ) : (
              <div className="space-y-4">
                {lowStock.map(product => (
                  <div key={product.id} className="flex items-center justify-between border-b last:border-0 pb-4 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(product.price)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={product.availableQuantity === 0 ? "destructive" : "secondary"}>
                        {product.availableQuantity} in stock
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
