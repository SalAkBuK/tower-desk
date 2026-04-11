"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const isOpaqueIdentifier = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) return true;
    if (/^[A-Za-z0-9_-]{24,}$/.test(trimmed) && !trimmed.includes("@") && !trimmed.includes(" ")) return true;
    return false;
};

type ContractModalSectionProps = {
    title: string;
    description?: string;
    badge?: string;
    className?: string;
    children: ReactNode;
};

export function ContractModalSection({
    title,
    description,
    badge,
    className,
    children,
}: ContractModalSectionProps) {
    return (
        <section className={cn("rounded-[24px] border border-zinc-200/80 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(24,24,27,0.35)]", className)}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{title}</h2>
                    {description ? <p className="max-w-3xl text-sm text-zinc-500">{description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                    {badge ? (
                        <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700"
                        >
                            {badge}
                        </Badge>
                    ) : null}
                </div>
            </div>
            <div className="mt-5 space-y-5">{children}</div>
        </section>
    );
}

type ContractModalFieldProps = {
    label: ReactNode;
    htmlFor?: string;
    hint?: ReactNode;
    error?: string;
    className?: string;
    children: ReactNode;
};

export function ContractModalField({
    label,
    htmlFor,
    hint,
    error,
    className,
    children,
}: ContractModalFieldProps) {
    return (
        <div className={cn("space-y-2", className)}>
            <Label htmlFor={htmlFor} className="text-sm font-medium text-zinc-900">
                {label}
            </Label>
            {children}
            {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}
            {!error && hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
        </div>
    );
}

type ContractSummaryCardProps = {
    label: string;
    title: string;
    description?: string;
    meta?: Array<string | null | undefined>;
    fields?: Array<{ label: string; value?: string | null | undefined }>;
    tone?: "neutral" | "accent";
};

export function ContractSummaryCard({
    label,
    title,
    description,
    meta,
    fields,
    tone = "neutral",
}: ContractSummaryCardProps) {
    const metaItems = (meta ?? [])
        .filter((item): item is string => Boolean(item && item.trim()))
        .filter((item) => !isOpaqueIdentifier(item));
    const fieldItems = (fields ?? [])
        .map((field) => ({ label: field.label, value: field.value?.trim() ?? "" }))
        .filter((field) => Boolean(field.value))
        .filter((field) => !isOpaqueIdentifier(field.value));

    return (
        <div
            className={cn(
                "rounded-[20px] border px-4 py-3.5 shadow-[0_12px_30px_-28px_rgba(24,24,27,0.3)]",
                tone === "accent"
                    ? "border-emerald-200/80 bg-emerald-50/70"
                    : "border-zinc-200 bg-zinc-50/70"
            )}
        >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
            <div className="mt-2 text-sm font-semibold text-zinc-950">{title}</div>
            {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
            {fieldItems.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {fieldItems.map((field) => (
                        <div
                            key={`${field.label}:${field.value}`}
                            className="rounded-xl border border-white/80 bg-white/95 px-3 py-2"
                        >
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                {field.label}
                            </div>
                            <div className="mt-1 text-sm font-medium text-zinc-900">{field.value}</div>
                        </div>
                    ))}
                </div>
            ) : metaItems.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {metaItems.map((item) => (
                        <span
                            key={item}
                            className="rounded-full border border-white/70 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

type ContractDisclosureSectionProps = {
    title: string;
    description?: string;
    defaultOpen?: boolean;
    children: ReactNode;
    className?: string;
};

export function ContractDisclosureSection({
    title,
    description,
    defaultOpen = false,
    children,
    className,
}: ContractDisclosureSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section className={cn("rounded-[24px] border border-zinc-200/80 bg-white shadow-[0_18px_40px_-32px_rgba(24,24,27,0.35)]", className)}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
            >
                <div className="space-y-1">
                    <div className="text-lg font-semibold tracking-tight text-zinc-950">{title}</div>
                    {description ? <p className="text-sm text-zinc-500">{description}</p> : null}
                </div>
                <div className="flex items-center gap-3">
                    <Badge
                        variant="outline"
                        className="border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-600"
                    >
                        {open ? "Expanded" : "Collapsed"}
                    </Badge>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-600">
                        <ChevronDown className={cn("h-4 w-4 transition-transform", open ? "rotate-180" : "")} />
                    </span>
                </div>
            </button>
            {open ? <div className="border-t border-zinc-200/80 px-5 py-5">{children}</div> : null}
        </section>
    );
}

export function useDeferredDialogReady(open: boolean) {
    const [ready, setReady] = useState(() => (typeof window === "undefined" ? open : false));

    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setReady(open));
        return () => window.cancelAnimationFrame(frame);
    }, [open]);

    return ready;
}
