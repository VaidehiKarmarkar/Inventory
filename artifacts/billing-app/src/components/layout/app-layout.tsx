import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Link, useLocation } from "wouter";
import { useLogout } from "@workspace/api-client-react";
import { LayoutDashboard, Package, History, ShoppingCart, LogOut, Loader2, UserSquare, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function SidebarContent({
  navItems,
  location,
  user,
  isAdmin,
  onNavigate,
  onLogout,
}: {
  navItems: { label: string; href: string; icon: React.ElementType }[];
  location: string;
  user: { name: string; role: string };
  isAdmin: boolean;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-sidebar-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-lg text-sidebar-primary-foreground">
          <Package className="w-6 h-6 text-primary" />
          <span>OptimaGodown</span>
        </div>
      </div>
      <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
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
      <div className="p-4 border-t border-sidebar-border/50 mt-auto">
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
          className="w-full justify-start text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log Out
        </Button>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth();
  const [location] = useLocation();
  const logout = useLogout();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
      onSuccess: () => {
        window.location.href = "/login";
      },
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

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden">
      {/* ── Desktop sidebar (always visible on md+) ── */}
      <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex-col h-full shrink-0">
        <SidebarContent
          navItems={navItems}
          location={location}
          user={user}
          isAdmin={isAdmin}
          onNavigate={() => {}}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar text-sidebar-foreground flex flex-col h-full shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          className="absolute top-3 right-3 p-1.5 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent
          navItems={navItems}
          location={location}
          user={user}
          isAdmin={isAdmin}
          onNavigate={() => setDrawerOpen(false)}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Main content area ── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-md text-foreground hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-base text-foreground">
            <Package className="w-5 h-5 text-primary" />
            <span>OptimaGodown</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
