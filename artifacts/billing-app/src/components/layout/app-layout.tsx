import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { LayoutDashboard, Package, History, ShoppingCart, LogOut, Loader2, UserSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();

  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  if (!user) return null;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/login";
      }
    });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Orders", href: "/orders", icon: ShoppingCart },
    ...(isAdmin ? [
      { label: "Products", href: "/products", icon: Package },
      { label: "Inventory Log", href: "/inventory", icon: History },
      { label: "Staff & Users", href: "/users", icon: UserSquare },
    ] : []),
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans">
      <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-sidebar-border/50">
          <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
            <Package className="w-6 h-6 text-primary" />
            <span>OptimaGodown</span>
          </div>
        </div>
        <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border/50 mt-auto">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium truncate">{user.name}</span>
              <span className="text-xs text-sidebar-foreground/50 truncate capitalize">{user.role}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Log Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto w-full h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
