"use client";

import { useState, useEffect } from "react";
import { signUp } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { LocationAxis } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, EyeOff } from "lucide-react";

type FormErrors = {
  full_name?: string;
  email?: string;
  phone?: string;
  default_location_id?: string;
  password?: string;
  confirm_password?: string;
};

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationAxis[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirm_password: "",
    default_location_id: "",
  });

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("location_axes")
      .select("*")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        if (data) setLocations(data);
      });
  }, []);

  function validate(): boolean {
    const newErrors: FormErrors = {};
    if (!form.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!form.email.trim()) newErrors.email = "Email address is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    else if (!/^[0-9]{10,11}$/.test(form.phone.replace(/\s/g, "")))
      newErrors.phone = "Enter a valid Nigerian phone number";
    if (!form.default_location_id)
      newErrors.default_location_id = "Please select your delivery area";
    if (!form.password) newErrors.password = "Password is required";
    else if (form.password.length < 6)
      newErrors.password = "Password must be at least 6 characters";
    if (!form.confirm_password)
      newErrors.confirm_password = "Please confirm your password";
    else if (form.password !== form.confirm_password)
      newErrors.confirm_password = "Passwords do not match";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleChange(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field as keyof FormErrors])
      setErrors((e) => ({ ...e, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const result = await signUp({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      default_location_id: form.default_location_id,
    });
    if (result?.error) {
      toast.error(result.error);
      setLoading(false);
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
        <CardHeader className="text-center pb-4 pt-7 px-8">
          <CardTitle className="text-xl font-bold tracking-tight">
            Create your account
          </CardTitle>
          <CardDescription className="mt-1">
            Book fresh beef every Saturday
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                placeholder="e.g. Ahmad Taiwo"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                className={`h-11 ${errors.full_name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.full_name && (
                <p className="text-xs text-red-500">{errors.full_name}</p>
              )}
            </div>

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
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="080xxxxxxxx"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className={`h-11 ${errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Your delivery area</Label>
              <Select
                value={form.default_location_id}
                onValueChange={(v) => handleChange("default_location_id", v)}
              >
                <SelectTrigger
                  id="location"
                  className={`h-11 ${errors.default_location_id ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                >
                  <SelectValue placeholder="Select your area" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.delivery_fee > 0 && (
                        <span className="text-muted-foreground ml-1">
                          (+₦{loc.delivery_fee.toLocaleString()})
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.default_location_id ? (
                <p className="text-xs text-red-500">
                  {errors.default_location_id}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can change this at checkout when ordering for someone else
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={`h-11 pr-11 ${errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              <Label htmlFor="confirm_password">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={form.confirm_password}
                  onChange={(e) =>
                    handleChange("confirm_password", e.target.value)
                  }
                  className={`h-11 pr-11 ${errors.confirm_password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs text-red-500">
                  {errors.confirm_password}
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-11 cursor-pointer"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Creating account..." : "Create new account"}
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground pt-1">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-primary font-medium hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
