import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  Package,
  History,
  ShoppingCart,
  LogOut,
  Loader2,
  UserSquare,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();

  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const onResize = () => setSidebarOpen(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => { window.location.href = "/login"; },
    });
  };

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Orders", href: "/orders", icon: ShoppingCart },
    ...(isAdmin
      ? [
          { label: "Products", href: "/products", icon: Package },
          { label: "Inventory Log", href: "/inventory", icon: History },
          { label: "Staff & Users", href: "/users", icon: UserSquare },
        ]
      : []),
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* ── Top header — always visible ── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0 z-30">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-2 rounded-md text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 font-bold text-base text-foreground select-none">
          <Package className="w-5 h-5 text-primary" />
          <span>OptimaGodown</span>
        </div>
      </header>

      {/* ── Body row ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-[52px] z-20 bg-black/50 md:hidden"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar — fixed overlay on mobile, inline-block on desktop */}
        <aside
          style={{ width: sidebarOpen ? 256 : 0 }}
          className="relative z-30 flex-shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full overflow-hidden transition-[width] duration-300 ease-in-out"
        >
          {/* Inner wrapper keeps content at fixed 256 px so it doesn't squash during animation */}
          <div className="w-64 flex flex-col h-full">
            <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { if (window.innerWidth < 768) closeSidebar(); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-sidebar-border/50">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{user.name}</span>
                  <span className="text-xs text-sidebar-foreground/50 truncate capitalize">{user.role}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground whitespace-nowrap"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2 shrink-0" />
                Log Out
              </Button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
