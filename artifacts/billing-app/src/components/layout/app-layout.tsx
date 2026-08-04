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
  Menu,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
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
    { label: "Products", href: "/products", icon: Package },
    { label: "Inventory Log", href: "/inventory", icon: History },
    { label: "Change Password", href: "/settings", icon: KeyRound },
  ];

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* ── Top header — always visible ── */}
      <header className="flex items-center gap-3 px-6 py-3.5 border-b border-border bg-white/70 dark:bg-black/60 backdrop-blur-md shrink-0 z-30 sticky top-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)]">
        <button
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-2 rounded-lg text-foreground/80 hover:text-foreground hover:bg-secondary transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 font-bold text-lg select-none">
          <div className="bg-orange-500/10 text-orange-600 dark:text-orange-500 p-1.5 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
          <span className="font-extrabold tracking-tight text-orange-600 dark:text-orange-500">Aloha Crystal World</span>
        </div>
      </header>

      {/* ── Body row ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-[56px] z-20 bg-black/40 backdrop-blur-xs md:hidden transition-opacity"
            onClick={closeSidebar}
          />
        )}

        {/* Sidebar — fixed overlay on mobile, inline-block on desktop */}
        <aside
          style={{ width: sidebarOpen ? 256 : 0 }}
          className="relative z-30 flex-shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col h-full overflow-hidden transition-[width] duration-300 ease-in-out"
        >
          {/* Inner wrapper keeps content at fixed 256 px so it doesn't squash during animation */}
          <div className="w-64 flex flex-col h-full justify-between">
            <nav className="flex-1 py-6 flex flex-col gap-1.5 overflow-y-auto px-4">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { if (window.innerWidth < 768) closeSidebar(); }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium whitespace-nowrap ${
                      isActive
                        ? "bg-gradient-to-r from-primary to-indigo-600 text-primary-foreground shadow-[0_4px_12px_rgba(95,69,255,0.3)] scale-[1.02]"
                        : "text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-sidebar-border/60 bg-black/20 m-3 rounded-xl">
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0 shadow-sm shadow-primary/20">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate leading-tight">{user.name}</span>
                  <span className="text-[11px] text-sidebar-foreground/50 truncate capitalize mt-0.5 font-mono bg-sidebar-accent/50 px-1.5 py-0.5 rounded-sm w-fit">{user.role}</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-transparent transition-all whitespace-nowrap cursor-pointer rounded-lg"
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
          <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-7xl mx-auto w-full">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
