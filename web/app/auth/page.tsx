"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clapperboard,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Key,
  ArrowRight,
  LogOut,
  Film,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect") || "/dashboard";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";

  const {
    user,
    loading: authLoading,
    isConfigured,
    signInWithPassword,
    signUpWithPassword,
    signInWithOtp,
    resetPasswordForEmail,
    signOut,
  } = useAuth();

  const [activeTab, setActiveTab] = React.useState<"signin" | "signup" | "magic" | "forgot">(initialMode);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [formLoading, setFormLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (searchParams.get("mode") === "signup") {
      setActiveTab("signup");
    } else if (searchParams.get("mode") === "magic") {
      setActiveTab("magic");
    }
  }, [searchParams]);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setErrorMsg("Please enter your director email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setFormLoading(true);
    try {
      const { error } = await signInWithPassword(email.trim(), password);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Signed in successfully. Redirecting to studio...");
        setTimeout(() => {
          router.push(redirectParam);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication failed. Please check your credentials.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim() || !password) {
      setErrorMsg("Please provide both email and a secure password.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must contain at least 6 characters.");
      return;
    }

    setFormLoading(true);
    try {
      const { error } = await signUpWithPassword(email.trim(), password, fullName.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Account created! Check your email to confirm registration or access your studio.");
        setTimeout(() => {
          router.push(redirectParam);
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Account creation failed. Please try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setErrorMsg("Please provide your email address to receive the magic link.");
      return;
    }

    setFormLoading(true);
    try {
      const { error } = await signInWithOtp(email.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Magic login link dispatched! Check your email inbox to sign in instantly.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to dispatch magic login link.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!email.trim()) {
      setErrorMsg("Please enter the email associated with your account.");
      return;
    }

    setFormLoading(true);
    try {
      const { error } = await resetPasswordForEmail(email.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Password reset link sent! Check your inbox.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to send reset link.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignOut = async () => {
    setFormLoading(true);
    try {
      await signOut();
      setSuccessMsg("You have been signed out successfully.");
    } finally {
      setFormLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-3" />
        <p className="text-xs font-mono text-muted-foreground">Checking authentication status...</p>
      </div>
    );
  }

  // If user is ALREADY signed in, render the account management view
  if (user) {
    const directorName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Director";
    const userInitials = (user.email || "AC").slice(0, 2).toUpperCase();

    return (
      <div className="max-w-md mx-auto w-full">
        <div className="rounded-xl border border-border/80 bg-[#0e1117] p-6 shadow-2xl space-y-6">
          <div className="flex items-center gap-3 border-b border-border/60 pb-5">
            <div className="h-12 w-12 rounded-full bg-accent text-accent-foreground font-bold flex items-center justify-center text-base shadow-md">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-semibold text-foreground truncate">{directorName}</h2>
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Account ID</span>
                <span className="text-foreground truncate max-w-[180px]">{user.id}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Database Sync</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> User Isolated
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Auth Provider</span>
                <span className="text-accent">Supabase Cloud</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              All scripts, character dossiers, video takes, and timeline revisions are linked to this individual account.
            </p>
          </div>

          <div className="pt-2 space-y-2.5">
            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-xs font-semibold h-10 gap-2 cursor-pointer shadow-md"
              onClick={() => router.push(redirectParam)}
            >
              <Film className="h-4 w-4" />
              <span>Enter Studio Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto" />
            </Button>

            <Button
              variant="outline"
              onClick={handleSignOut}
              disabled={formLoading}
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-9 gap-2 cursor-pointer font-mono"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{formLoading ? "Signing Out..." : "Sign Out of Account"}</span>
            </Button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
            ← Return to Backlot Landing
          </Link>
        </div>
      </div>
    );
  }

  // Not signed in: render the auth forms
  return (
    <div className="max-w-md mx-auto w-full">
      <div className="rounded-xl border border-border/80 bg-[#0c0e14] shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-b from-secondary/50 via-secondary/20 to-transparent p-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-black/50 border border-accent/30 flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-heading font-semibold tracking-tight text-foreground">
                BlendEye Studio Auth
              </h1>
              <p className="text-xs text-muted-foreground">
                Personalized writers&apos; room bound to your individual director account
              </p>
            </div>
          </div>

          {!isConfigured && (
            <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="leading-snug">
                Supabase credentials not detected. BlendEye is cloud-only, so sign-in is unavailable until you configure <code className="bg-background/40 px-1 py-0.5 rounded text-[10px]">NEXT_PUBLIC_SUPABASE_URL</code> and <code className="bg-background/40 px-1 py-0.5 rounded text-[10px]">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
              </span>
            </div>
          )}
        </div>

        {/* Form Container */}
        <div className="p-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); resetMessages(); }}>
            <TabsList className="grid grid-cols-2 w-full bg-secondary/40 p-1 mb-5 border border-border/40">
              <TabsTrigger value="signin" className="text-xs font-medium cursor-pointer">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-xs font-medium cursor-pointer">
                Create Account
              </TabsTrigger>
            </TabsList>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex flex-col gap-2 text-xs text-destructive">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
                {(errorMsg.toLowerCase().includes("email") || errorMsg.toLowerCase().includes("confirm")) && (
                  <Link
                    href={redirectParam}
                    className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground font-semibold text-xs hover:bg-accent/90 transition-colors w-full text-center"
                  >
                    <span>Continue to Studio Directly (Skip Confirmation) →</span>
                  </Link>
                )}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex flex-col gap-2 text-xs text-emerald-300">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
                <Link
                  href={redirectParam}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 transition-colors w-full text-center"
                >
                  <span>Skip Email Verification &amp; Enter Studio →</span>
                </Link>
              </div>
            )}

            {/* TAB: SIGN IN */}
            <TabsContent value="signin" className="space-y-4 m-0">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Director Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@agenticcinema.com"
                    className="h-10 bg-secondary/30 border-border/80 text-xs focus-visible:ring-accent"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => { setActiveTab("forgot"); resetMessages(); }}
                      className="text-[11px] font-mono text-accent hover:underline cursor-pointer"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-10 bg-secondary/30 border-border/80 text-xs pr-9 focus-visible:ring-accent"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-10 text-xs bg-accent text-accent-foreground hover:bg-accent/90 font-semibold cursor-pointer shadow-md mt-2"
                >
                  {formLoading ? "Authenticating..." : "Sign In to Backlot"}
                </Button>
              </form>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => { setActiveTab("magic"); resetMessages(); }}
                  className="text-xs text-muted-foreground hover:text-accent font-mono flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span>Use passwordless email magic link</span>
                </button>
              </div>
            </TabsContent>

            {/* TAB: SIGN UP */}
            <TabsContent value="signup" className="space-y-4 m-0">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Director / Writer Name
                  </Label>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Denis Villeneuve"
                    className="h-10 bg-secondary/30 border-border/80 text-xs focus-visible:ring-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email Address
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@agenticcinema.com"
                    className="h-10 bg-secondary/30 border-border/80 text-xs focus-visible:ring-accent"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Create Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="h-10 bg-secondary/30 border-border/80 text-xs pr-9 focus-visible:ring-accent"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-10 text-xs bg-accent text-accent-foreground hover:bg-accent/90 font-semibold cursor-pointer shadow-md mt-2"
                >
                  {formLoading ? "Creating Director Account..." : "Create Account & Start Slating"}
                </Button>
              </form>
            </TabsContent>

            {/* TAB: MAGIC LINK */}
            <TabsContent value="magic" className="space-y-4 m-0">
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email for Magic Login Link
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@agenticcinema.com"
                    className="h-10 bg-secondary/30 border-border/80 text-xs focus-visible:ring-accent"
                    autoComplete="email"
                    required
                  />
                </div>

                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                  We&apos;ll dispatch a secure one-click sign in link directly to your inbox. No password required.
                </p>

                <Button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-10 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium cursor-pointer shadow-md"
                >
                  {formLoading ? "Dispatching Magic Link..." : "Send Magic Link"}
                </Button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("signin"); resetMessages(); }}
                    className="text-xs text-muted-foreground hover:text-foreground font-mono cursor-pointer"
                  >
                    ← Back to standard password login
                  </button>
                </div>
              </form>
            </TabsContent>

            {/* TAB: FORGOT PASSWORD */}
            <TabsContent value="forgot" className="space-y-4 m-0">
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Registered Account Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@agenticcinema.com"
                    className="h-10 bg-secondary/30 border-border/80 text-xs focus-visible:ring-accent"
                    autoComplete="email"
                    required
                  />
                </div>

                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                  Enter your email address and we&apos;ll send you instructions to reset your password.
                </p>

                <Button
                  type="submit"
                  disabled={formLoading}
                  className="w-full h-10 text-xs bg-accent text-accent-foreground hover:bg-accent/90 font-semibold cursor-pointer shadow-md"
                >
                  {formLoading ? "Sending Reset Email..." : "Send Password Reset Instructions"}
                </Button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => { setActiveTab("signin"); resetMessages(); }}
                    className="text-xs text-muted-foreground hover:text-foreground font-mono cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer Ribbon */}
          <div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5">
              <Key className="h-3 w-3 text-accent" />
              Supabase Auth Engine
            </span>
            <span className="text-muted-foreground">Account required</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/" className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
          ← Return to Backlot Landing
        </Link>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#07090e] text-foreground flex flex-col justify-center items-center px-4 py-12 relative selection:bg-accent/30 selection:text-accent-foreground">
      {/* Cinematic subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-10 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full flex flex-col items-center">
        <Suspense fallback={
          <div className="min-h-[50vh] flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
        }>
          <AuthPageContent />
        </Suspense>
      </div>
    </div>
  );
}
