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
import { Loader2, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the session in the URL hash after clicking the reset link
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
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
      toast.error("Failed to reset password. Please try again.");
      setLoading(false);
    } else {
      toast.success("Password updated! Signing you in...");
      setTimeout(() => router.replace("/"), 1500);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="mb-6">
          <Image
            src="/logo.jpeg"
            alt="Edible Mart"
            width={40}
            height={10}
            className="object-contain rounded-xl invert"
            priority
          />
        </div>
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="px-8 py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              Verifying reset link...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-background">
      <div className="mb-6">
        <Image
          src="/logo.png"
          alt="Edible Mart"
          width={80}
          height={10}
          className="object-contain rounded-lg"
          priority
        />
      </div>

      <Card className="w-full max-w-md shadow-sm">
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
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
