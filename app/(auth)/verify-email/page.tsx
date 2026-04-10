"use client";

import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resending, setResending] = useState(false);

  async function resendEmail() {
    if (!email) return;
    setResending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) toast.error("Failed to resend. Please try again.");
    else toast.success("Verification email resent!");
    setResending(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-background">
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
        <CardHeader className="text-center pb-4 pt-7 px-8">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Check your email
          </CardTitle>
          <CardDescription className="mt-1">
            We sent a verification link to
            {email && (
              <>
                <br />
                <strong className="text-foreground">{email}</strong>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8 space-y-5">
          <div className="rounded-xl bg-muted p-4 space-y-2 text-sm text-muted-foreground">
            <p>
              1. Open the email from <strong>Edible Mart</strong>
            </p>
            <p>
              2. Click the <strong>&quot;Confirm your email&quot;</strong> link
            </p>
            <p>3. You&apos;ll be signed in automatically</p>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Didn&apos;t get the email? Check your spam folder or resend below.
          </p>

          <Button
            variant="outline"
            className="w-full cursor-pointer"
            onClick={resendEmail}
            disabled={resending || !email}
          >
            {resending && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
            {resending ? "Resending..." : "Resend verification email"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Wrong email?{" "}
            <Link
              href="/signup"
              className="text-primary font-medium hover:underline"
            >
              Sign up again
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
