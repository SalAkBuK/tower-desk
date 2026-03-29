"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Building2, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/api/auth";

const GENERIC_SUCCESS_MESSAGE = "If an account exists, we sent a reset link.";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const canSubmit = useMemo(() => isValidEmail(email) && !isSubmitting, [email, isSubmitting]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isValidEmail(email) || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await forgotPassword(email.trim());
        } catch {
            // Keep response generic to avoid account enumeration.
        } finally {
            setIsSubmitting(false);
            setIsSubmitted(true);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#f6f2ea] px-4 py-10 text-slate-900 sm:px-6">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 right-[-4rem] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_top,_#9ad7c7,_transparent_70%)] opacity-70 blur-3xl" />
                <div className="absolute bottom-[-6rem] left-[-6rem] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_bottom,_#f6c98d,_transparent_70%)] opacity-60 blur-3xl" />
            </div>

            <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center">
                <Card className="w-full border-emerald-100/70 bg-white/85 shadow-xl shadow-emerald-100/60 backdrop-blur">
                    <CardHeader className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-700">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                                <Building2 className="h-5 w-5" />
                            </span>
                            <span className="text-sm font-semibold tracking-wide">TowerDesk Pro</span>
                        </div>
                        <CardTitle className="text-2xl font-semibold text-slate-900">Forgot password</CardTitle>
                        <CardDescription className="text-slate-600">
                            Enter your email and we will send a reset link.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {isSubmitted ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
                                <p className="mb-2 flex items-center gap-2 font-medium">
                                    <MailCheck className="h-4 w-4" />
                                    Email sent
                                </p>
                                <p>{GENERIC_SUCCESS_MESSAGE}</p>
                            </div>
                        ) : (
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div className="grid gap-2">
                                    <Label htmlFor="email" className="text-slate-700">Email address</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        className="h-11 border-slate-200 bg-white/90 text-slate-900 placeholder:text-slate-400"
                                        required
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="h-11 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
                                    disabled={!canSubmit}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Sending reset link...
                                        </>
                                    ) : (
                                        "Send reset link"
                                    )}
                                </Button>
                            </form>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-wrap gap-2 text-sm">
                        <Button asChild variant="ghost" className="h-9 px-2 text-slate-600 hover:text-slate-900">
                            <Link href="/login">
                                <ArrowLeft className="h-4 w-4" />
                                Back to login
                            </Link>
                        </Button>
                        {isSubmitted ? (
                            <Button variant="outline" className="h-9" onClick={() => setIsSubmitted(false)}>
                                Send another link
                            </Button>
                        ) : null}
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
