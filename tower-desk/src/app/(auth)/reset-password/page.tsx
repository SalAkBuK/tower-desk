"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/api";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
    const mode = useMemo(() => searchParams.get("mode") ?? "", [searchParams]);
    const isInviteMode = mode === "invite";
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
    const isMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
    const isValid = token.length > 0
        && newPassword.length >= MIN_PASSWORD_LENGTH
        && confirmPassword === newPassword
        && !isSubmitting;

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!isValid) return;

        setError(null);
        setIsSubmitting(true);
        try {
            await resetPassword(token, newPassword);
            toast.success(
                isInviteMode
                    ? "Password set successfully. Your account is ready. Please sign in."
                    : "Password reset successful. Please sign in."
            );
            router.replace(isInviteMode ? "/login?onboarding=invite" : "/login");
        } catch (err) {
            const status = (err as { status?: number })?.status;
            if (status === 401) {
                setError(
                    isInviteMode
                        ? "Invite link is invalid or expired. Request a new invite."
                        : "Link is invalid or expired. Request a new reset email."
                );
            } else if (status === 400) {
                setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
            } else {
                setError(
                    isInviteMode
                        ? "We could not set your password right now. Please try again."
                        : "We could not reset your password right now. Please try again."
                );
            }
        } finally {
            setIsSubmitting(false);
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
                        <CardTitle className="text-2xl font-semibold text-slate-900">
                            {isInviteMode ? "Set password" : "Reset password"}
                        </CardTitle>
                        <CardDescription className="text-slate-600">
                            {isInviteMode
                                ? "Set a password to finish onboarding your account."
                                : "Choose a new password for your account."}
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {!token ? (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                {isInviteMode ? "Invalid invite link" : "Invalid reset link"}
                            </div>
                        ) : (
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div className="grid gap-2">
                                    <Label htmlFor="newPassword" className="text-slate-700">New password</Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="Enter a strong password"
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                        className="h-11 border-slate-200 bg-white/90 text-slate-900 placeholder:text-slate-400"
                                        required
                                    />
                                    <p className="text-xs text-slate-500">Minimum {MIN_PASSWORD_LENGTH} characters.</p>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="confirmPassword" className="text-slate-700">Confirm password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        className="h-11 border-slate-200 bg-white/90 text-slate-900 placeholder:text-slate-400"
                                        required
                                    />
                                </div>

                                {isTooShort ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        Password must be at least {MIN_PASSWORD_LENGTH} characters.
                                    </div>
                                ) : null}
                                {isMismatch ? (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                        Passwords do not match.
                                    </div>
                                ) : null}
                                {error ? (
                                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                        {error}
                                    </div>
                                ) : null}

                                <Button
                                    type="submit"
                                    className="h-11 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-700"
                                    disabled={!isValid}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {isInviteMode ? "Setting password..." : "Resetting password..."}
                                        </>
                                    ) : (
                                        isInviteMode ? "Set password" : "Reset password"
                                    )}
                                </Button>
                            </form>
                        )}
                    </CardContent>

                    <CardFooter className="text-sm">
                        <Button asChild variant="ghost" className="h-9 px-2 text-slate-600 hover:text-slate-900">
                            <Link href={token ? "/login" : "/forgot-password"}>
                                <ArrowLeft className="h-4 w-4" />
                                {token ? "Back to login" : "Request new reset email"}
                            </Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
