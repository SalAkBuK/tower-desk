"use client";

import Link from "next/link";
import { ArrowRight, Bell, Building2, ClipboardList, MessageCircle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
    useOwnerConversationUnreadCount,
    useOwnerNotificationUnreadCount,
    useOwnerPortfolioRequests,
    useOwnerPortfolioSummary,
    useOwnerPortfolioUnits,
    useOwnerRequestCommentUnreadCount,
} from "@/lib/queries";
import { statusLabels } from "@/components/requests/requestDisplay";

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export function OwnerDashboardPage() {
    const { baseRole } = useAuth();
    const enabled = baseRole === "owner";
    const summaryQuery = useOwnerPortfolioSummary({ enabled });
    const unitsQuery = useOwnerPortfolioUnits({ enabled });
    const requestsQuery = useOwnerPortfolioRequests({ enabled });
    const unreadCommentsQuery = useOwnerRequestCommentUnreadCount({ enabled });
    const unreadConversationsQuery = useOwnerConversationUnreadCount({ enabled });
    const unreadNotificationsQuery = useOwnerNotificationUnreadCount({ enabled });

    const summary = summaryQuery.data ?? { unitCount: 0, orgCount: 0, buildingCount: 0 };
    const units = unitsQuery.data ?? [];
    const requests = requestsQuery.data ?? [];
    const recentRequests = [...requests]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5);

    if (baseRole !== "owner") {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h1 className="text-xl font-semibold text-zinc-950">Owner Dashboard</h1>
                <p className="mt-2 text-sm text-zinc-500">This portal surface is limited to owner users.</p>
            </div>
        );
    }

    if (summaryQuery.isLoading && !summaryQuery.data) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h1 className="text-xl font-semibold text-zinc-950">Owner Dashboard</h1>
                <p className="mt-2 text-sm text-zinc-500">Loading owner portfolio...</p>
            </div>
        );
    }

    if (summary.unitCount === 0 && units.length === 0 && requests.length === 0) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-950">No owner portfolio access</h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            The owner runtime is active, but there are no visible units, requests, or cross-org access grants in scope.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                            Owner portal
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">Portfolio overview</h1>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
                            Cross-org owner access is aggregated here. Request and conversation cards always keep the org and building context visible.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/portal/requests">
                            Review requests
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                    {[
                        { label: "Units", value: summary.unitCount, icon: Building2, tone: "bg-zinc-100 text-zinc-700" },
                        { label: "Organizations", value: summary.orgCount, icon: Building2, tone: "bg-zinc-100 text-zinc-700" },
                        { label: "Buildings", value: summary.buildingCount, icon: Building2, tone: "bg-zinc-100 text-zinc-700" },
                        { label: "Requests", value: requests.length, icon: ClipboardList, tone: "bg-amber-50 text-amber-700" },
                        { label: "Unread comments", value: unreadCommentsQuery.data ?? 0, icon: MessageCircle, tone: "bg-emerald-50 text-emerald-700" },
                        { label: "Unread notifications", value: unreadNotificationsQuery.data ?? 0, icon: Bell, tone: "bg-blue-50 text-blue-700" },
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
                <div className="mt-4 text-sm text-zinc-500">
                    Conversation unread count: <span className="font-medium text-zinc-900">{unreadConversationsQuery.data ?? 0}</span>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-zinc-950">Recent request activity</h2>
                            <p className="text-sm text-zinc-500">Latest approval and maintenance threads across your portfolio.</p>
                        </div>
                        <Button variant="outline" asChild>
                            <Link href="/portal/messages">Open messages</Link>
                        </Button>
                    </div>
                    <div className="mt-5 space-y-3">
                        {recentRequests.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                                No owner-visible requests yet.
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
                                        {request.orgName ? <Badge className="bg-zinc-100 text-zinc-700">{request.orgName}</Badge> : null}
                                        {request.buildingName ? <Badge className="bg-zinc-100 text-zinc-700">{request.buildingName}</Badge> : null}
                                    </div>
                                    <div className="mt-3">
                                        <div className="text-base font-semibold text-zinc-950">{request.title}</div>
                                        <div className="mt-1 text-sm text-zinc-500">{request.unit?.label ?? "No unit"} · Updated {formatDate(request.updatedAt)}</div>
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    <h2 className="text-lg font-semibold text-zinc-950">Portfolio units</h2>
                    <p className="mt-1 text-sm text-zinc-500">Current cross-org unit visibility resolved from active owner access grants.</p>
                    <div className="mt-5 space-y-3">
                        {units.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">
                                No units in the active owner portfolio.
                            </div>
                        ) : (
                            units.slice(0, 8).map((unit) => (
                                <div key={unit.unitId} className="rounded-2xl border border-zinc-200 p-4">
                                    <div className="text-sm font-semibold text-zinc-950">{unit.unitLabel ?? unit.unitId}</div>
                                    <div className="mt-1 text-sm text-zinc-500">{unit.orgName ?? unit.orgId}</div>
                                    <div className="text-xs text-zinc-400">{unit.buildingName ?? unit.buildingId}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}
