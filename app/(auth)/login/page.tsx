"use client";

import { useState } from "react";
import { signIn } from "@/app/actions/auth";
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
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";

type FormErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [form, setForm] = useState({ email: "", password: "" });

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!form.email.trim()) newErrors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";
    if (!form.password) newErrors.password = "Password is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const result = await signIn(form);
    if (result?.error) {
      toast.error("Incorrect email or password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-background">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center gap-3">
        {/* <div className="w-16 h-16 rounded-2xl bg-[#1C0A06] flex items-center justify-center overflow-hidden shadow-md">
          <Image
            src="/icon-logo.png"
            alt="Edible Mart icon"
            width={56}
            height={56}
            className="object-contain"
            priority
          />
        </div> */}
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
        <CardHeader className="text-center pb-4 pt-7 px-8">
          <CardTitle className="text-xl font-bold tracking-tight">
            Welcome back
          </CardTitle>
          <CardDescription className="mt-1">
            Sign in to your Edible Mart account
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className={`h-11 ${errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {/* Forgot password — we can wire this up later */}
                <span className="text-xs text-muted-foreground cursor-not-allowed">
                  Forgot password?
                </span>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Your password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                className={`h-11 ${errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-11 cursor-pointer"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground pt-1">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-primary font-medium hover:underline"
              >
                Create one
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
