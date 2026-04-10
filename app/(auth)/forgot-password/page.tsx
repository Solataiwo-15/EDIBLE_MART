"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );

    if (resetError) {
      toast.error("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
    setLoading(false);
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
        <CardHeader className="text-center pb-4 pt-7 px-8">
          <CardTitle className="text-xl font-bold tracking-tight">
            Reset your password
          </CardTitle>
          <CardDescription className="mt-1">
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Check your email</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We sent a password reset link to <strong>{email}</strong>.
                  Check your inbox and click the link to reset your password.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="cursor-pointer mt-2 gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  className={`h-11 ${error ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {error && <p className="text-xs text-red-500">{error}</p>}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-11 cursor-pointer"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Sending..." : "Send reset link"}
                </Button>
              </div>

              <div className="text-center">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
