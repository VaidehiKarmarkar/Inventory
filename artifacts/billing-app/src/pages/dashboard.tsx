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
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: any;
  loading?: boolean;
  color?: "indigo" | "blue" | "purple" | "emerald" | "teal" | "rose";
}

function StatCard({ title, value, icon: Icon, loading, color = "indigo" }: StatCardProps) {
  const colorMap = {
    indigo: { border: "border-l-indigo-500", bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400" },
    blue: { border: "border-l-blue-500", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
    purple: { border: "border-l-purple-500", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
    emerald: { border: "border-l-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    teal: { border: "border-l-teal-500", bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400" },
    rose: { border: "border-l-rose-500", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  };

  const current = colorMap[color] || colorMap.indigo;

  return (
    <Card className={`premium-card border-l-4 ${current.border} shadow-sm transition-all duration-300 hover:scale-[1.02] bg-white/70 dark:bg-black/40 backdrop-blur-xs`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-xl ${current.bg} ${current.text}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <Skeleton className="h-9 w-28 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();

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
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back, {user?.name || "User"}. Here is what's happening at OptimaGodown today.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-time Sync Active</span>
        </div>
      </div>

      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Products" value={formatNumber(adminData?.totalProducts || 0)} icon={Package} loading={adminLoading} color="indigo" />
          <StatCard title="Total Inventory" value={formatNumber(adminData?.totalInventory || 0)} icon={Activity} loading={adminLoading} color="blue" />
          <StatCard title="Total Orders" value={formatNumber(adminData?.totalOrders || 0)} icon={ShoppingCart} loading={adminLoading} color="purple" />
          <StatCard title="Today's Sales" value={formatCurrency(adminData?.todaySales || 0)} icon={TrendingUp} loading={adminLoading} color="emerald" />
          <StatCard title="Monthly Sales" value={formatCurrency(adminData?.monthlySales || 0)} icon={TrendingUp} loading={adminLoading} color="teal" />
          <StatCard title="Out of Stock" value={formatNumber(adminData?.outOfStockCount || 0)} icon={AlertTriangle} loading={adminLoading} color="rose" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Orders Today" value={formatNumber(userData?.ordersToday || 0)} icon={ShoppingCart} loading={userLoading} color="indigo" />
          <StatCard title="Total Orders" value={formatNumber(userData?.totalOrders || 0)} icon={Activity} loading={userLoading} color="blue" />
          <StatCard title="Total Revenue" value={formatCurrency(userData?.totalRevenue || 0)} icon={TrendingUp} loading={userLoading} color="emerald" />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-4">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">Recent Orders</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Latest transactions processed in the portal.</p>
            </div>
            <Link href="/orders" className="text-xs font-semibold text-primary hover:text-indigo-600 transition-colors flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg cursor-pointer">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            {ordersLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : !recentOrders?.length ? (
              <div className="text-center py-10 text-muted-foreground text-sm">No recent orders found.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:bg-secondary/40 px-2 rounded-lg transition-all">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-semibold text-sm tracking-tight text-foreground">{order.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                    </div>
                    <div className="text-right flex flex-col gap-1 items-end">
                      <p className="font-bold text-sm text-foreground">{formatCurrency(order.grandTotal)}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase font-mono px-2 py-0.5 tracking-wider rounded-md font-bold">{order.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-rose-500/10 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-rose-500/10 pb-4">
            <div className="flex items-center gap-2">
              <div className="bg-rose-500/10 text-rose-600 dark:text-rose-400 p-1.5 rounded-lg">
                <AlertTriangle className="w-4.5 h-4.5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-foreground">Low Stock Alerts</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Products require replenishment soon.</p>
              </div>
            </div>
            {isAdmin && (
              <Link href="/products" className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors bg-rose-500/5 border border-rose-500/10 px-3 py-1.5 rounded-lg cursor-pointer">
                Manage Stock
              </Link>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {stockLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
              </div>
            ) : !lowStock?.length ? (
              <div className="text-center py-10 text-muted-foreground text-sm">All products are adequately stocked.</div>
            ) : (
              <div className="divide-y divide-border/60">
                {lowStock.map(product => (
                  <div key={product.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:bg-rose-500/5 px-2 rounded-lg transition-all">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-semibold text-sm tracking-tight text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{formatCurrency(product.price)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={product.availableQuantity === 0 ? "destructive" : "outline"} className={`px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wider uppercase ${product.availableQuantity > 0 ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5" : ""}`}>
                        {product.availableQuantity === 0 ? "OUT OF STOCK" : `${product.availableQuantity} LEFT`}
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
