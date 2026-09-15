"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { Clapperboard, Lock, Mail, User, ShieldCheck, AlertCircle, Sparkles, Key } from "lucide-react";

export function AuthDialog() {
  const { isAuthModalOpen, closeAuthModal, signInWithPassword, signUpWithPassword, signInWithOtp, isConfigured } = useAuth();
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetState = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      if (useMagicLink) {
        const { error } = await signInWithOtp(email.trim());
        if (error) {
          setErrorMsg(error.message);
        } else {
          setSuccessMsg("Magic login link dispatched! Check your email inbox.");
        }
      } else {
        if (!password) {
          setErrorMsg("Please enter your password.");
          setLoading(false);
          return;
        }
        const { error } = await signInWithPassword(email.trim(), password);
        if (error) {
          setErrorMsg(error.message);
        } else {
          closeAuthModal();
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetState();

    if (!email.trim() || !password) {
      setErrorMsg("Please enter both email and a secure password.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUpWithPassword(email.trim(), password, fullName.trim());
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Account created! Check your email for verification, or you may be auto-signed in.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="sm:max-w-[440px] bg-[#0c0e14] border border-border/80 text-foreground p-0 overflow-hidden shadow-2xl">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-b from-secondary/40 to-transparent p-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="h-9 w-9 rounded-lg bg-black/50 border border-accent/30 flex items-center justify-center overflow-hidden shadow-sm">
              <img src="/logo.png" alt="BlendEye" className="h-full w-full object-cover" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">
                Writers' Room Access
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sign in with Supabase to sync your production slates across sessions
              </DialogDescription>
            </div>
          </div>

          {!isConfigured && (
            <div className="mt-3 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-xs text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Supabase credentials not detected in environment. Operating in offline sandbox mode.
              </span>
            </div>
          )}
        </div>

        {/* Tab Controls */}
        <div className="p-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as any); resetState(); }}>
            <TabsList className="grid grid-cols-2 w-full bg-secondary/50 p-1 mb-5">
              <TabsTrigger value="signin" className="text-xs font-medium">
                Sign In
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-xs font-medium">
                Create Account
              </TabsTrigger>
            </TabsList>

            {errorMsg && (
              <div className="mb-4 p-2.5 rounded-md bg-destructive/15 border border-destructive/30 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-2.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-start gap-2 text-xs text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
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
                    className="h-9 bg-secondary/30 border-border/80 text-xs"
                    autoComplete="email"
                    required
                  />
                </div>

                {!useMagicLink && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" />
                        Password
                      </Label>
                    </div>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 bg-secondary/30 border-border/80 text-xs"
                      autoComplete="current-password"
                      required={!useMagicLink}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => { setUseMagicLink(!useMagicLink); resetState(); }}
                    className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer font-mono"
                  >
                    <Sparkles className="h-3 w-3" />
                    {useMagicLink ? "Use password instead" : "Use passwordless magic link"}
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium cursor-pointer mt-2"
                >
                  {loading ? "Authenticating…" : useMagicLink ? "Send Magic Link" : "Sign In to Backlot"}
                </Button>
              </form>
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
                    placeholder="Quentin Villeneuve"
                    className="h-9 bg-secondary/30 border-border/80 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director@agenticcinema.com"
                    className="h-9 bg-secondary/30 border-border/80 text-xs"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" />
                    Password
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="h-9 bg-secondary/30 border-border/80 text-xs"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-9 text-xs bg-foreground text-background hover:bg-foreground/90 font-medium cursor-pointer mt-2"
                >
                  {loading ? "Creating Credentials…" : "Create Director Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer Note */}
          <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <a
              href="/auth"
              onClick={() => closeAuthModal()}
              className="flex items-center gap-1.5 text-accent hover:underline cursor-pointer"
            >
              <Key className="h-3 w-3" />
              Open Dedicated Auth Page →
            </a>
            <button
              onClick={closeAuthModal}
              className="text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Maybe later
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
