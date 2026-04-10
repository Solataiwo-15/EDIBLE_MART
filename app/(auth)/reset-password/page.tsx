"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";

type Status = "verifying" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("verifying");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );

  useEffect(() => {
    const supabase = createClient();

    // Method 1: Check if there's already a valid session with recovery type
    // This happens when Supabase redirects back with a hash token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("ready");
        return;
      }

      // Method 2: Listen for PASSWORD_RECOVERY event
      // This fires when Supabase processes the hash/code from the URL
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          event === "PASSWORD_RECOVERY" ||
          (event === "SIGNED_IN" && session)
        ) {
          setStatus("ready");
        }
      });

      // Method 3: If URL has a code param (PKCE flow), exchange it
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) setStatus("invalid");
          else setStatus("ready");
        });
      }

      // Timeout — if nothing resolves in 8 seconds, show invalid
      const timeout = setTimeout(() => {
        setStatus((prev) => (prev === "verifying" ? "invalid" : prev));
      }, 8000);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    });
  }, []);

  function validate() {
    const newErrors: typeof errors = {};
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (!form.confirm) newErrors.confirm = "Please confirm your password";
    else if (form.password !== form.confirm)
      newErrors.confirm = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: form.password,
    });

    if (error) {
      toast.error(
        "Failed to reset password. The link may have expired — request a new one.",
      );
      setLoading(false);
    } else {
      toast.success("Password updated successfully!");
      setTimeout(() => router.replace("/"), 1500);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-background">
      <div className="mb-6">
        <Image
          src="/logo.jpeg"
          alt="Edible Mart"
          width={70}
          height={10}
          className="object-contain rounded-xl invert"
          priority
        />
      </div>

      <Card className="w-full max-w-md shadow-sm">
        {/* Verifying state */}
        {status === "verifying" && (
          <CardContent className="px-8 py-14 flex flex-col items-center gap-3 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Verifying reset link...
            </p>
          </CardContent>
        )}

        {/* Invalid / expired link */}
        {status === "invalid" && (
          <>
            <CardHeader className="text-center pb-4 pt-7 px-8">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-600" />
              </div>
              <CardTitle className="text-xl font-bold">
                Link expired or invalid
              </CardTitle>
              <CardDescription className="mt-1">
                This password reset link has expired or already been used.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8 space-y-3">
              <Link href="/forgot-password">
                <Button className="w-full cursor-pointer">
                  Request a new reset link
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full cursor-pointer">
                  Back to sign in
                </Button>
              </Link>
            </CardContent>
          </>
        )}

        {/* Ready — show the form */}
        {status === "ready" && (
          <>
            <CardHeader className="text-center pb-4 pt-7 px-8">
              <CardTitle className="text-xl font-bold tracking-tight">
                Set new password
              </CardTitle>
              <CardDescription className="mt-1">
                Choose a strong password for your account
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, password: e.target.value }));
                        setErrors((er) => ({ ...er, password: undefined }));
                      }}
                      className={`h-11 pr-11 ${errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter new password"
                      value={form.confirm}
                      onChange={(e) => {
                        setForm((f) => ({ ...f, confirm: e.target.value }));
                        setErrors((er) => ({ ...er, confirm: undefined }));
                      }}
                      className={`h-11 pr-11 ${errors.confirm ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      tabIndex={-1}
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirm && (
                    <p className="text-xs text-red-500">{errors.confirm}</p>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-11 cursor-pointer"
                    disabled={loading}
                  >
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {loading ? "Updating..." : "Update password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
