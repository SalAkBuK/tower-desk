"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login as loginApi } from "@/lib/api";
import { getDefaultHomeRoute } from "@/lib/homeRoute";

export default function LoginPage() {
    const { login, user, status, baseRole } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const formatLoginError = (err: unknown) => {
        if (!err) return "Unable to sign in. Please try again.";
        if (err instanceof Error) {
            try {
                const parsed = JSON.parse(err.message);
                const code = parsed?.error?.code || parsed?.code;
                if (code === "Unauthorized") {
                    return "Email or password is incorrect.";
                }
                if (code === "Forbidden") {
                    return "Your account does not have access to this app.";
                }
                const message = parsed?.error?.message || parsed?.message;
                if (typeof message === "string" && message.trim()) {
                    return message;
                }
            } catch {
                // fall through
            }
            return err.message || "Unable to sign in. Please try again.";
        }
        return "Unable to sign in. Please try again.";
    };

    useEffect(() => {
        if (status === 'authenticated' && user) {
            if (process.env.NODE_ENV !== "production") {
                console.log("[Login] Authenticated user:", user);
            }
            router.replace(getDefaultHomeRoute(user, baseRole));
        }
    }, [status, user, baseRole, router]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            if (process.env.NODE_ENV !== "production") {
                console.log("[Login] Submitting login for:", email.trim());
            }
            const { user, token, refreshToken } = await loginApi(email.trim(), password);
            if (process.env.NODE_ENV !== "production") {
                console.log("[Login] Login response user:", user);
            }
            login(user, token, refreshToken);
        } catch (err) {
            setError(formatLoginError(err));
            if (process.env.NODE_ENV !== "production") {
                console.error("[Login] Login failed:", err);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f6f2ea] text-slate-900">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_top,_#9ad7c7,_transparent_70%)] opacity-70 blur-3xl" />
                <div className="absolute bottom-[-6rem] left-[-6rem] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_bottom,_#f6c98d,_transparent_70%)] opacity-60 blur-3xl" />
                <div className="absolute left-1/2 top-10 h-24 w-24 -translate-x-1/2 rounded-3xl bg-[linear-gradient(135deg,_rgba(255,255,255,0.6),_rgba(255,255,255,0))] shadow-[0_18px_50px_rgba(148,163,184,0.25)]" />
            </div>
            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
                <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1 text-sm font-medium text-emerald-700 shadow-sm">
                            <Sparkles className="h-4 w-4" />
                            Smart building operations
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-2xl font-semibold text-slate-900">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
                                    <Building2 className="h-6 w-6" />
                                </span>
                                TowerDesk
                            </div>
                            <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
                                Welcome back to a brighter command center.
                            </h1>
                            <p className="max-w-xl text-base text-slate-600">
                                Sign in to manage buildings, coordinate staff, and track service requests with real-time clarity.
                            </p>
                        </div>
                        <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                            <div className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 shadow-sm">
                                Track requests with priority insights.
                            </div>
                            <div className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 shadow-sm">
                                Assign admins with confidence.
                            </div>
                            <div className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 shadow-sm">
                                Keep tenants informed instantly.
                            </div>
                            <div className="rounded-2xl border border-white/80 bg-white/60 px-4 py-3 shadow-sm">
                                Centralized visibility in one dashboard.
                            </div>
                        </div>
                    </div>
                    <Card className="w-full border-emerald-100/70 bg-white/80 shadow-xl shadow-emerald-100/60 backdrop-blur animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CardHeader className="space-y-2">
                            <CardTitle className="text-2xl font-semibold text-slate-900">Sign in</CardTitle>
                            <CardDescription className="text-slate-500">
                                Use your admin account credentials to continue.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-slate-700">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@towerdesk.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="h-11 border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400"
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="password" className="text-slate-700">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        className="h-11 border-slate-200 bg-white/80 text-slate-900 placeholder:text-slate-400"
                                        required
                                    />
                                    <div className="flex justify-end">
                                        <Link href="/forgot-password" className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                                            Forgot password?
                                        </Link>
                                    </div>
                                </div>
                                {error ? (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                        {error}
                                    </div>
                                ) : null}
                                <Button
                                    type="submit"
                                    className="h-11 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
                                    disabled={isSubmitting || !email || !password}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        "Sign in"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                        <CardFooter className="text-xs text-slate-500">
                            Need access? Contact your building administrator to get set up.
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    );
}
