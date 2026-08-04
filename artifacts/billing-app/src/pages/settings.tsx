import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, KeyRound, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast({ title: "Please enter your current password", variant: "destructive" });
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      toast({ title: "New password must be at least 4 characters long", variant: "destructive" });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: "New password and confirm password do not match", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ title: data.error || "Failed to update password", variant: "destructive" });
      } else {
        toast({
          title: "Password Updated!",
          description: "Your password has been securely encrypted and updated.",
        });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground via-foreground/90 to-foreground/80">
          Account &amp; Security Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your master account credentials and change your password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Change Password Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="border-b border-border/40 bg-muted/20">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                <CardTitle className="text-lg">Change Password</CardTitle>
              </div>
              <CardDescription>
                Update your account password. New passwords are automatically hashed with bcrypt before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5" data-testid="form-change-password">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrent ? "text" : "password"}
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="pr-10"
                      data-testid="input-current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNew ? "text" : "password"}
                      placeholder="Enter new password (min. 4 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      data-testid="input-new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10"
                      data-testid="input-confirm-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {newPassword && confirmPassword && (
                  <div className="text-xs flex items-center gap-1.5 pt-1">
                    {newPassword === confirmPassword ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-destructive flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold h-10 shadow-sm cursor-pointer"
                  data-testid="button-update-password"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Update Password
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Single Account Overview */}
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-md">
            <CardHeader className="bg-muted/20 border-b border-border/40 pb-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                <CardTitle className="text-base">Master Account Details</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">Account Name</span>
                <span className="font-semibold text-foreground">{user?.name || "System Administrator"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Username</span>
                <span className="font-mono text-foreground font-medium">@{user?.username || "admin"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Access Role</span>
                <Badge variant="default" className="mt-1 bg-orange-600 text-white capitalize">
                  {user?.role || "admin"}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Account Status</span>
                <Badge variant="outline" className="mt-1 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                  Active (Single Master User)
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-orange-500/20 bg-orange-500/5 shadow-sm">
            <CardContent className="pt-5 pb-5 text-xs text-muted-foreground space-y-2">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Bcrypt Encryption Standard</span>
              </div>
              <p className="leading-relaxed">
                All passwords are encrypted with 10 salt rounds of <strong>bcrypt</strong> before saving to the database. Plaintext passwords are never logged or stored.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
