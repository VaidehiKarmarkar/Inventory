import { useState } from "react";
import { useLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Package, Loader2, KeyRound, ShieldAlert, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function Login() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const login = useLogin();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { username, password } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries();
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: err.message || "Invalid credentials. Please try again."
          });
        }
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background font-sans overflow-hidden">
      {/* ── Left Pane: Modern Branding (hidden on mobile) ── */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-sidebar text-sidebar-foreground p-16 relative overflow-hidden border-r border-sidebar-border select-none">
        {/* Glow effect blobs */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

        {/* Logo/Brand Header */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center shadow-inner">
            <Package className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-extrabold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-100">Aloha Crystal World</span>
        </div>

        {/* Hero Content */}
        <div className="space-y-6 z-10 max-w-lg my-auto">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Introducing v2.0 local engine</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
            Billing &amp; Stock Tracking <br/>Built for Godowns.
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Manage your local inventory log, design new billing items, generate print-ready invoice PDFs, and run warehouse operations concurrently with zero-latency.
          </p>
        </div>

        {/* Footer/System Status */}
        <div className="flex items-center justify-between text-xs text-slate-500 z-10 border-t border-sidebar-border/40 pt-6">
          <span>© 2026 Inventory Masters Inc.</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            DB Local Connected
          </span>
        </div>
      </div>

      {/* ── Right Pane: Elegant Login Form ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50 dark:bg-zinc-950 relative">
        <div className="absolute top-10 right-10 md:hidden flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight text-foreground">Aloha Crystal World</span>
        </div>

        <div className="w-full max-w-md">
          <Card className="border border-border/80 shadow-2xl rounded-2xl bg-white/70 dark:bg-black/40 backdrop-blur-md overflow-hidden relative">
            <CardHeader className="space-y-2 pb-6 text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center mb-2 shadow-sm">
                <KeyRound className="w-5 h-5" />
              </div>
              <CardTitle className="text-2xl font-extrabold tracking-tight text-foreground">Welcome Back</CardTitle>
              <CardDescription className="text-slate-500 text-sm">
                Sign in to manage your inventory and billing portal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10.5 rounded-xl border-slate-200 focus-visible:ring-primary focus-visible:border-transparent transition-all"
                  />
                </div>
                <Button type="submit" className="w-full h-10.5 rounded-xl cursor-pointer font-semibold shadow-md bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95 text-white border-0 transition-all" disabled={login.isPending}>
                  {login.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Sign In
                </Button>
              </form>

              {/* Demo Credentials Helper Box */}
              <div className="border border-border/80 bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-bl-lg">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">System Access Control:</p>
                <div className="bg-white dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 text-xs">
                  <span className="font-bold text-[10px] uppercase text-indigo-500 tracking-wider">Admin Privilege Required</span>
                  <div className="font-semibold text-slate-700 dark:text-slate-300 mt-1 font-mono">admin / admin123</div>
                  <p className="text-[11px] text-muted-foreground mt-1">Non-admin user access disabled. Full management active.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
