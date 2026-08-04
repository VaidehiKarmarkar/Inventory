import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowRight,
  Sparkles,
  BarChart3,
  Calendar,
  PieChart as PieIcon,
  Layers,
  Filter,
  Download,
  FileSpreadsheet,
  Database
} from "lucide-react";
import { Link } from "wouter";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface MonthAnalytics {
  monthKey: string;
  monthLabel: string;
  orderCount: number;
  revenue: number;
  paidAmount: number;
  pendingAmount: number;
}

interface ProductAnalytics {
  productId: number;
  productName: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

interface AnalyticsSummary {
  totalOrders: number;
  totalRevenue: number;
  totalPaid: number;
  totalPending: number;
}

interface AnalyticsData {
  monthWise: MonthAnalytics[];
  productWise: ProductAnalytics[];
  summary: AnalyticsSummary;
}

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

const PIE_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#14b8a6", // Teal
  "#f43f5e", // Rose
];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

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

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["dashboard-analytics", dateFrom, dateTo],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (dateFrom) queryParams.set("dateFrom", dateFrom);
      if (dateTo) queryParams.set("dateTo", dateTo);
      const res = await fetch(`/api/dashboard/analytics?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
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

  // Prepare chart data
  const monthChartData = analyticsData?.monthWise ?? [];
  const pieChartData = analyticsData?.productWise?.map(p => ({
    name: p.productName,
    value: p.totalQuantitySold,
    revenue: p.totalRevenue,
  })) ?? [];

  const paymentStatusData = [
    { name: "Paid Amount", value: analyticsData?.summary?.totalPaid ?? 0, color: "#10b981" },
    { name: "Pending Balance", value: analyticsData?.summary?.totalPending ?? 0, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">Dashboard &amp; Analytics</h1>
          <p className="text-muted-foreground text-sm">Welcome back, {user?.name || "User"}. Operational overview &amp; real-time sales reporting for <span className="font-bold text-orange-600 dark:text-orange-500">Aloha Crystal World</span>.</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm gap-2 cursor-pointer" data-testid="button-download-excel-backup">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Backup in Excel</span>
                <Download className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem asChild className="cursor-pointer font-semibold py-2.5">
                <a href="/api/dashboard/export/excel" download data-testid="menu-item-master-backup">
                  <Database className="w-4 h-4 mr-2 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-foreground">Full Master Excel Backup</p>
                    <p className="text-[10px] text-muted-foreground font-normal">All Orders, Products, Stock &amp; Analytics</p>
                  </div>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer py-2">
                <a href="/api/dashboard/export/orders" download data-testid="menu-item-orders-backup">
                  <ShoppingCart className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-xs font-medium">All Orders &amp; Invoices (.csv)</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer py-2">
                <a href="/api/dashboard/export/inventory" download data-testid="menu-item-inventory-backup">
                  <Package className="w-4 h-4 mr-2 text-primary" />
                  <span className="text-xs font-medium">Products &amp; Stock Levels (.csv)</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Real-time Sync Active</span>
          </div>
        </div>
      </div>

      {/* Customizable Date Filter Bar */}
      <Card className="p-4 bg-muted/30 border-border/70">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter Sales &amp; Graphs</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <Select value={datePreset} onValueChange={handleDatePresetChange}>
              <SelectTrigger className="w-44 h-9 text-xs font-semibold bg-background" data-testid="select-dashboard-date-preset">
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
              onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); }}
              className="w-36 h-9 text-xs bg-background"
            />
            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); }}
              className="w-36 h-9 text-xs bg-background"
            />

            {(dateFrom || dateTo) && (
              <button
                onClick={() => handleDatePresetChange("all")}
                className="text-xs text-primary hover:underline font-bold px-2 cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Top Stat Cards */}
      {isAdmin ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Total Products" value={formatNumber(adminData?.totalProducts || 0)} icon={Package} loading={adminLoading} color="indigo" />
          <StatCard title="Total Inventory" value={formatNumber(adminData?.totalInventory || 0)} icon={Activity} loading={adminLoading} color="blue" />
          <StatCard title="Filtered Total Orders" value={formatNumber(analyticsData?.summary?.totalOrders ?? adminData?.totalOrders ?? 0)} icon={ShoppingCart} loading={analyticsLoading} color="purple" />
          <StatCard title="Filtered Total Revenue" value={formatCurrency(analyticsData?.summary?.totalRevenue ?? adminData?.monthlySales ?? 0)} icon={TrendingUp} loading={analyticsLoading} color="emerald" />
          <StatCard title="Filtered Total Paid" value={formatCurrency(analyticsData?.summary?.totalPaid ?? 0)} icon={TrendingUp} loading={analyticsLoading} color="teal" />
          <StatCard title="Filtered Pending Balance" value={formatCurrency(analyticsData?.summary?.totalPending ?? 0)} icon={AlertTriangle} loading={analyticsLoading} color="rose" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Orders Today" value={formatNumber(userData?.ordersToday || 0)} icon={ShoppingCart} loading={userLoading} color="indigo" />
          <StatCard title="Total Orders" value={formatNumber(userData?.totalOrders || 0)} icon={Activity} loading={userLoading} color="blue" />
          <StatCard title="Total Revenue" value={formatCurrency(userData?.totalRevenue || 0)} icon={TrendingUp} loading={userLoading} color="emerald" />
        </div>
      )}

      {/* Visual Graphs & Charts Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">Interactive Sales &amp; Product Visualizations</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly / Periodical Revenue Bar Chart */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Sales Revenue vs Paid Trend
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">Revenue Comparison</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : !monthChartData.length ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-xs">No chart data for selected range.</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip formatter={(val: number) => [`₹${val.toFixed(2)}`, ""]} />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="revenue" name="Total Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="paidAmount" name="Paid Amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pendingAmount" name="Pending Balance" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Sales Pie Chart */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-primary" />
                  Top Crystal Types (Pie Chart by Qty Sold)
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">Product Share</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {analyticsLoading ? (
                <Skeleton className="h-64 w-full rounded-xl" />
              ) : !pieChartData.length ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-xs">No product sales logged yet.</div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name.slice(0, 12)} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number, name: string, props: any) => [`${val} units (₹${props.payload.revenue.toFixed(2)})`, props.payload.name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Month-wise Revenue Table */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span>Month-Wise Orders &amp; Revenue Breakdown</span>
                <Badge variant="outline" className="text-[10px] font-mono">Detailed Table</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {analyticsLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !analyticsData?.monthWise?.length ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No monthly sales data found for selected period.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">Month</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Orders</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Total Revenue</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Paid Amount</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {analyticsData.monthWise.map((m) => (
                      <tr key={m.monthKey} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-bold text-foreground">{m.monthLabel}</td>
                        <td className="px-4 py-3 text-right font-mono">{m.orderCount}</td>
                        <td className="px-4 py-3 text-right font-bold">{formatCurrency(m.revenue)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{formatCurrency(m.paidAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          {m.pendingAmount > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(m.pendingAmount)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Product-wise Sales Table */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-white/50 dark:bg-black/30 backdrop-blur-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Product-Wise Top Sales Breakdown
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">By Units Sold</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {analyticsLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !analyticsData?.productWise?.length ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No product sales logged yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">CRYSTAL TYPE</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Qty Sold</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Total Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs">
                    {analyticsData.productWise.map((p) => (
                      <tr key={p.productId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{p.productName}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge variant="secondary" className="font-mono text-[10px] font-bold">
                            {p.totalQuantitySold} units
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-primary">{formatCurrency(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

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
                  <div key={product.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 hover:bg-rose-500/5 px-2 rounded-lg transition-all font-sans">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-semibold text-sm tracking-tight text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(product.price)}</p>
                    </div>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 text-[10px] font-bold px-2 py-0.5">
                      {product.availableQuantity} left
                    </Badge>
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
