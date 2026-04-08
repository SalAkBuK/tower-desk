"use client";

import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, ClipboardList, MessageCircle, ShieldAlert, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useProviderRequestUnreadCount, useProviderRequests, useProviderRuntimeContext } from "@/lib/queries";
import { statusLabels } from "@/components/requests/requestDisplay";

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export function ProviderDashboardPage() {
    const { baseRole } = useAuth();
    const providerContextQuery = useProviderRuntimeContext({ enabled: baseRole === "service_provider" });
    const providerAccess = providerContextQuery.data?.providers ?? [];
    const singleProviderAccess = providerAccess.length === 1 ? providerAccess[0] : null;
    const hasNoProviderAccess = providerAccess.length === 0;
    const hasMultipleProviderAccess = providerAccess.length > 1;

    const requestsQuery = useProviderRequests({
        enabled: baseRole === "service_provider" && Boolean(singleProviderAccess),
        serviceProviderId: singleProviderAccess?.providerId,
    });
    const unreadCountQuery = useProviderRequestUnreadCount({
        enabled: baseRole === "service_provider" && Boolean(singleProviderAccess),
    });

    const requests = requestsQuery.data ?? [];
    const unreadCount = unreadCountQuery.data ?? 0;
    const activeCount = requests.filter((entry) => entry.status === "pending" || entry.status === "assigned" || entry.status === "in-progress").length;
    const completedCount = requests.filter((entry) => entry.status === "completed").length;
    const recentRequests = [...requests].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);

    if (baseRole !== "service_provider") {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h1 className="text-xl font-semibold text-zinc-950">Provider Dashboard</h1>
                <p className="mt-2 text-sm text-zinc-500">This portal surface is limited to provider managers.</p>
            </div>
        );
    }

    if (providerContextQuery.isLoading && !providerContextQuery.data) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h1 className="text-xl font-semibold text-zinc-950">Provider Dashboard</h1>
                <p className="mt-2 text-sm text-zinc-500">Loading provider access...</p>
            </div>
        );
    }

    if (hasNoProviderAccess) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-950">No provider access</h1>
                        <p className="mt-2 text-sm text-zinc-500">`GET /provider/me` returned no active provider memberships for this user.</p>
                    </div>
                </div>
            </div>
        );
    }

    if (hasMultipleProviderAccess) {
        return (
            <div className="space-y-6">
                <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        Provider portal
                    </div>
                    <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">Provider selection required</h1>
                    <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                        This account can access multiple providers. The current backend still blocks most `/provider/*` detail and write routes without a single active provider context.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                        {providerAccess.map((provider) => (
                            <Badge key={provider.providerId} className="bg-zinc-100 text-zinc-700">
                                {provider.name} · {provider.role}
                            </Badge>
                        ))}
                    </div>
                    <div className="mt-6">
                        <Button asChild>
                            <Link href="/portal/requests">
                                Open request queue
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Provider manager portal
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">Operations dashboard</h1>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                            Live request activity for {singleProviderAccess?.name}. Current role: {String(singleProviderAccess?.role ?? "WORKER").toUpperCase()}.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/portal/requests">
                            Open queue
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                        { label: "Assigned requests", value: requests.length, icon: ClipboardList, tone: "bg-zinc-100 text-zinc-700" },
                        { label: "Active work", value: activeCount, icon: Wrench, tone: "bg-blue-50 text-blue-700" },
                        { label: "Unread comments", value: unreadCount, icon: MessageCircle, tone: "bg-emerald-50 text-emerald-700" },
                        { label: "Completed", value: completedCount, icon: CheckCircle2, tone: "bg-amber-50 text-amber-700" },
                    ].map((card) => (
                        <div key={card.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.tone}`}>
                                <card.icon className="h-5 w-5" />
                            </div>
                            <div className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{card.value}</div>
                            <p className="text-xs text-zinc-500">{card.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-semibold text-zinc-950">Recent request activity</h2>
                        <p className="text-sm text-zinc-500">Jump straight into the latest provider-side updates.</p>
                    </div>
                    {unreadCount > 0 ? <Badge className="bg-emerald-50 text-emerald-700">{unreadCount} unread</Badge> : null}
                </div>

                <div className="mt-5 space-y-3">
                    {recentRequests.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                            No provider requests yet.
                        </div>
                    ) : (
                        recentRequests.map((request) => (
                            <Link
                                key={request.id}
                                href="/portal/requests"
                                className="block rounded-2xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="bg-zinc-100 text-zinc-700">{statusLabels[request.status]}</Badge>
                                    {request.buildingName ? <Badge className="bg-zinc-100 text-zinc-700">{request.buildingName}</Badge> : null}
                                </div>
                                <div className="mt-3 flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="truncate text-base font-semibold text-zinc-950">{request.title}</div>
                                        <div className="mt-1 flex items-center gap-2 text-sm text-zinc-500">
                                            <Building2 className="h-4 w-4" />
                                            <span>{request.unit?.label ?? "No unit"}</span>
                                        </div>
                                    </div>
                                    <span className="shrink-0 text-xs text-zinc-400">{formatDate(request.updatedAt)}</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
