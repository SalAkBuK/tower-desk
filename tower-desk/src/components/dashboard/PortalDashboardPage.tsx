"use client";

import { useMemo } from "react";
import {
    Activity,
    AlertTriangle,
    Bell,
    Building2,
    Car,
    CheckCircle2,
    ClipboardList,
    LayoutDashboard,
    Megaphone,
    UserRoundPlus,
    Users,
    Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { getUserPermissionSet, hasPermission } from "@/lib/permissions";
import { useDashboardActivity, useDashboardOverview } from "@/lib/queries";
import type {
    DashboardActivityItem,
    DashboardBroadcastsTrendPoint,
    DashboardMaintenanceTrendPoint,
    DashboardOverviewResponse,
    DashboardVisitorsTrendPoint,
} from "@/lib/types";

const formatCompactNumber = (value: number) =>
    new Intl.NumberFormat(undefined, {
        notation: Math.abs(value) >= 1000 ? "compact" : "standard",
        maximumFractionDigits: 1,
    }).format(value);

const RECENT_ACTIVITY_LIMIT = 8;

const formatPercent = (value: number) => `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;

const formatAxisDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatFeedDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const getTickIndices = (length: number, maxTicks = 6) => {
    if (length <= 0) return [];
    if (length <= maxTicks) return Array.from({ length }, (_, index) => index);

    const lastIndex = length - 1;
    const step = lastIndex / (maxTicks - 1);
    const ticks = new Set<number>();

    for (let index = 0; index < maxTicks; index += 1) {
        ticks.add(Math.round(index * step));
    }

    return Array.from(ticks).sort((a, b) => a - b);
};

const buildScaledPoints = (points: number[], width: number, height: number) => {
    if (points.length === 0) return [];

    const maxValue = Math.max(...points, 1);
    const xStep = points.length === 1 ? width / 2 : width / (points.length - 1);

    return points.map((point, index) => {
        const x = points.length === 1 ? width / 2 : index * xStep;
        const y = height - (point / maxValue) * height;
        return { x, y, value: point };
    });
};

const buildLinePath = (points: number[], width: number, height: number) => {
    if (points.length === 0) return "";

    return buildScaledPoints(points, width, height)
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
};

const buildAreaPath = (points: number[], width: number, height: number) => {
    if (points.length === 0) return "";

    const scaledPoints = buildScaledPoints(points, width, height);
    const line = scaledPoints
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");

    const lastPoint = scaledPoints[scaledPoints.length - 1];
    const firstPoint = scaledPoints[0];

    return `${line} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
};

function EmptyStatePanel({ label }: { label: string }) {
    return (
        <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 text-sm text-zinc-500">
            {label}
        </div>
    );
}

function ChartFrame({
    children,
    maxValue,
    tickIndices,
    labels,
}: {
    children: React.ReactNode;
    maxValue: number;
    tickIndices: number[];
    labels: string[];
}) {
    const yTicks = [maxValue, Math.round(maxValue / 2), 0];

    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
            <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-3">
                <div className="flex h-44 flex-col justify-between pt-1 text-[11px] text-zinc-400">
                    {yTicks.map((tick, index) => (
                        <span key={`${tick}-${index}`}>{formatCompactNumber(tick)}</span>
                    ))}
                </div>
                <div className="space-y-3">
                    {children}
                    <div className="flex items-center justify-between gap-3 text-[11px] text-zinc-400">
                        {tickIndices.map((index) => (
                            <span key={`${labels[index]}-${index}`} className="min-w-0 truncate">
                                {labels[index]}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MaintenanceChart({ data }: { data: DashboardMaintenanceTrendPoint[] }) {
    if (data.length === 0) return <EmptyStatePanel label="No maintenance trend data yet." />;

    const width = 360;
    const height = 176;
    const created = data.map((entry) => entry.created);
    const completed = data.map((entry) => entry.completed);
    const maxValue = Math.max(...created, ...completed, 1);
    const tickIndices = getTickIndices(data.length);
    const createdPath = buildLinePath(created, width, height);
    const completedPath = buildLinePath(completed, width, height);
    const createdPoints = buildScaledPoints(created, width, height);
    const completedPoints = buildScaledPoints(completed, width, height);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Created
                </div>
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    Completed
                </div>
            </div>

            <ChartFrame
                maxValue={maxValue}
                tickIndices={tickIndices}
                labels={data.map((entry) => formatAxisDate(entry.date))}
            >
                <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
                    {[0, 0.5, 1].map((ratio) => {
                        const y = height * ratio;
                        return <line key={ratio} x1="0" y1={y} x2={width} y2={y} className="stroke-zinc-200" />;
                    })}
                    <path d={createdPath} fill="none" stroke="#d97706" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={completedPath} fill="none" stroke="#059669" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    {createdPoints.map((point, index) =>
                        tickIndices.includes(index) ? <circle key={`created-${data[index].date}`} cx={point.x} cy={point.y} r="3" fill="#d97706" /> : null,
                    )}
                    {completedPoints.map((point, index) =>
                        tickIndices.includes(index) ? <circle key={`completed-${data[index].date}`} cx={point.x} cy={point.y} r="3" fill="#059669" /> : null,
                    )}
                </svg>
            </ChartFrame>
        </div>
    );
}

function VisitorsChart({ data }: { data: DashboardVisitorsTrendPoint[] }) {
    if (data.length === 0) return <EmptyStatePanel label="No visitor trend data yet." />;

    const width = 360;
    const height = 176;
    const series = data.map((entry) => entry.created);
    const labels = data.map((entry) => formatAxisDate(entry.date));
    const tickIndices = getTickIndices(data.length);
    const maxValue = Math.max(...series, 1);
    const points = buildScaledPoints(series, width, height);
    const linePath = buildLinePath(series, width, height);
    const areaPath = buildAreaPath(series, width, height);
    const total = series.reduce((sum, value) => sum + value, 0);
    const peakIndex = series.findIndex((value) => value === maxValue);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Series Total</div>
                    <div className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">{formatCompactNumber(total)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Peak Day</div>
                    <div className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">{formatCompactNumber(maxValue)}</div>
                    <div className="mt-1 text-xs text-zinc-500">{peakIndex >= 0 ? labels[peakIndex] : "N/A"}</div>
                </div>
            </div>

            <ChartFrame maxValue={maxValue} tickIndices={tickIndices} labels={labels}>
                <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible">
                    {[0, 0.5, 1].map((ratio) => {
                        const y = height * ratio;
                        return <line key={ratio} x1="0" y1={y} x2={width} y2={y} className="stroke-zinc-200" />;
                    })}
                    <path d={areaPath} fill="rgba(37,99,235,0.10)" />
                    <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    {points.map((point, index) =>
                        tickIndices.includes(index) ? <circle key={data[index].date} cx={point.x} cy={point.y} r="3" fill="#2563eb" /> : null,
                    )}
                </svg>
            </ChartFrame>
        </div>
    );
}

function BroadcastsChart({ data }: { data: DashboardBroadcastsTrendPoint[] }) {
    if (data.length === 0) return <EmptyStatePanel label="No broadcast trend data yet." />;

    const maxRecipients = Math.max(...data.map((entry) => entry.recipientCount), 1);
    const totalRecipients = data.reduce((sum, entry) => sum + entry.recipientCount, 0);

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Recipients Reached</div>
                <div className="mt-1 text-xl font-semibold tracking-tight text-zinc-950">{formatCompactNumber(totalRecipients)}</div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="space-y-4">
                    {data.map((entry) => (
                        <div key={entry.date} className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                            <div className="text-xs text-zinc-500">{formatAxisDate(entry.date)}</div>
                            <div className="h-2 rounded-full bg-zinc-200">
                                <div
                                    className="h-full rounded-full bg-emerald-600"
                                    style={{
                                        width: `${Math.max((entry.recipientCount / maxRecipients) * 100, entry.recipientCount > 0 ? 5 : 0)}%`,
                                    }}
                                />
                            </div>
                            <div className="text-right text-xs font-medium text-zinc-600">{entry.sent} sent</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const activityPresentation = (type: string) => {
    switch (type) {
        case "maintenance.created":
            return { icon: Wrench, tone: "bg-amber-50 text-amber-700", label: "Maintenance" };
        case "maintenance.completed":
            return { icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700", label: "Maintenance" };
        case "maintenance.canceled":
            return { icon: AlertTriangle, tone: "bg-rose-50 text-rose-700", label: "Maintenance" };
        case "visitor.created":
            return { icon: UserRoundPlus, tone: "bg-sky-50 text-sky-700", label: "Visitor" };
        case "broadcast.created":
            return { icon: Megaphone, tone: "bg-zinc-100 text-zinc-700", label: "Broadcast" };
        case "parking.allocated":
        case "parking.ended":
            return { icon: Car, tone: "bg-zinc-100 text-zinc-700", label: "Parking" };
        case "lease.created":
            return { icon: ClipboardList, tone: "bg-zinc-100 text-zinc-700", label: "Lease" };
        default:
            return { icon: Activity, tone: "bg-zinc-100 text-zinc-700", label: "Activity" };
    }
};

function ActivityFeed({ items }: { items: DashboardActivityItem[] }) {
    const cappedItems = items.slice(0, RECENT_ACTIVITY_LIMIT);

    if (cappedItems.length === 0) {
        return (
            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                No recent activity yet.
            </div>
        );
    }

    return (
        <div className="max-h-[560px] overflow-y-auto rounded-2xl border border-zinc-200">
            {cappedItems.map((item, index) => {
                const presentation = activityPresentation(item.type);
                const Icon = presentation.icon;

                return (
                    <div
                        key={`${item.type}-${item.entityId ?? index}-${item.occurredAt}`}
                        className={`flex items-start gap-3 bg-white px-4 py-4 ${index === 0 ? "" : "border-t border-zinc-200"}`}
                    >
                        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${presentation.tone}`}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-medium text-zinc-950">{item.title}</p>
                                <Badge variant="secondary" className="border border-zinc-200 bg-zinc-50 text-zinc-600">
                                    {presentation.label}
                                </Badge>
                            </div>
                            {item.description ? <p className="mt-1 text-sm leading-6 text-zinc-600">{item.description}</p> : null}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                                <span>{formatFeedDate(item.occurredAt)}</span>
                                {item.buildingName ? <span>{item.buildingName}</span> : null}
                                {item.entityType && item.entityId ? <span>{item.entityType}:{item.entityId}</span> : null}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OverviewSkeleton() {
    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton key={index} className="h-28 rounded-3xl" />
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-80 rounded-3xl" />
                ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <Skeleton className="h-[420px] rounded-3xl" />
                <Skeleton className="h-[420px] rounded-3xl" />
            </div>
        </div>
    );
}

const buildKpiCards = (overview: DashboardOverviewResponse | undefined) => {
    const summary = overview?.summary;

    return [
        {
            label: "Buildings",
            value: summary?.buildingsTotal ?? 0,
            detail: "Properties in scope",
            icon: Building2,
            tone: "bg-zinc-100 text-zinc-700",
        },
        {
            label: "Units",
            value: summary?.unitsTotal ?? 0,
            detail: `${summary?.occupiedUnits ?? 0} occupied / ${summary?.vacantUnits ?? 0} vacant`,
            icon: LayoutDashboard,
            tone: "bg-zinc-100 text-zinc-700",
        },
        {
            label: "Occupancy",
            value: formatPercent(summary?.occupancyRate ?? 0),
            detail: `${summary?.activeLeases ?? 0} active leases`,
            icon: Users,
            tone: "bg-emerald-50 text-emerald-700",
        },
        {
            label: "Maintenance",
            value: summary?.openMaintenanceRequests ?? 0,
            detail: `${summary?.overdueMaintenanceRequests ?? 0} overdue`,
            icon: Wrench,
            tone: "bg-amber-50 text-amber-700",
        },
        {
            label: "Visitors Today",
            value: summary?.visitorsToday ?? 0,
            detail: "Scheduled and checked in",
            icon: UserRoundPlus,
            tone: "bg-blue-50 text-blue-700",
        },
        {
            label: "Parking",
            value: summary?.activeParkingAllocations ?? 0,
            detail: "Active allocations",
            icon: Car,
            tone: "bg-zinc-100 text-zinc-700",
        },
        {
            label: "Broadcasts",
            value: summary?.broadcastsLast30Days ?? 0,
            detail: "Last 30 days",
            icon: Megaphone,
            tone: "bg-zinc-100 text-zinc-700",
        },
        {
            label: "Unread Alerts",
            value: summary?.unreadNotifications ?? 0,
            detail: "Pending notifications",
            icon: Bell,
            tone: "bg-rose-50 text-rose-700",
        },
    ];
};

export function PortalDashboardPage() {
    const { user } = useAuth();
    const permissionSet = getUserPermissionSet(user);
    const canReadDashboard = hasPermission(permissionSet, "dashboard.read");

    const overviewQuery = useDashboardOverview({ enabled: canReadDashboard });
    const activityQuery = useDashboardActivity(RECENT_ACTIVITY_LIMIT, { enabled: canReadDashboard });

    const kpis = useMemo(() => buildKpiCards(overviewQuery.data), [overviewQuery.data]);
    const buildings = overviewQuery.data?.buildings ?? [];
    const activityItems = activityQuery.data?.items ?? [];

    if (!canReadDashboard) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Dashboard</h1>
                <p className="mt-2 text-sm text-zinc-500">You do not have permission to view dashboard data.</p>
            </div>
        );
    }

    if (overviewQuery.isLoading || activityQuery.isLoading) {
        return <OverviewSkeleton />;
    }

    if (overviewQuery.isError || activityQuery.isError) {
        const message =
            overviewQuery.error instanceof Error
                ? overviewQuery.error.message
                : activityQuery.error instanceof Error
                    ? activityQuery.error.message
                    : "Failed to load dashboard.";

        return (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
                <h1 className="text-2xl font-semibold tracking-tight text-rose-900">Dashboard unavailable</h1>
                <p className="mt-2 text-sm text-rose-700">{message}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <section className="rounded-[28px] border border-zinc-200 bg-white px-6 py-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:px-8 md:py-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
                            <LayoutDashboard className="h-3.5 w-3.5 text-emerald-600" />
                            Operations dashboard
                        </div>
                        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">Dashboard</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 md:text-base">
                            Live operating signals across occupancy, maintenance, visitors, parking, and resident communications.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400">Generated</div>
                        <div className="mt-1 text-sm font-medium text-zinc-900">
                            {overviewQuery.data?.generatedAt ? formatFeedDate(overviewQuery.data.generatedAt) : "Just now"}
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {kpis.map((card) => (
                        <div key={card.label} className="rounded-3xl border border-zinc-200 bg-white p-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${card.tone}`}>
                                <card.icon className="h-4 w-4" />
                            </div>
                            <div className="mt-4 text-[11px] uppercase tracking-[0.14em] text-zinc-400">{card.label}</div>
                            <div className="mt-1 text-3xl font-semibold tracking-tight text-zinc-950">
                                {typeof card.value === "number" ? formatCompactNumber(card.value) : card.value}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-zinc-500">{card.detail}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-3">
                <Card className="rounded-[28px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg text-zinc-950">Maintenance Flow</CardTitle>
                        <CardDescription>Created versus completed requests over time.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <MaintenanceChart data={overviewQuery.data?.trends.maintenance ?? []} />
                    </CardContent>
                </Card>

                <Card className="rounded-[28px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg text-zinc-950">Visitor Volume</CardTitle>
                        <CardDescription>Daily visitor activity across the current series.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <VisitorsChart data={overviewQuery.data?.trends.visitors ?? []} />
                    </CardContent>
                </Card>

                <Card className="rounded-[28px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg text-zinc-950">Broadcast Reach</CardTitle>
                        <CardDescription>Recent outbound communications and recipients reached.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <BroadcastsChart data={overviewQuery.data?.trends.broadcasts ?? []} />
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                <Card className="rounded-[28px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg text-zinc-950">Building Breakdown</CardTitle>
                        <CardDescription>Unit, occupancy, lease, maintenance, and parking status by building.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {buildings.length === 0 ? (
                            <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-500">
                                No buildings in scope yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-2xl border border-zinc-200">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-zinc-50">
                                        <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-zinc-400">
                                            <th className="px-4 py-3 font-medium">Building</th>
                                            <th className="px-4 py-3 font-medium">Units</th>
                                            <th className="px-4 py-3 font-medium">Occupancy</th>
                                            <th className="px-4 py-3 font-medium">Leases</th>
                                            <th className="px-4 py-3 font-medium">Maintenance</th>
                                            <th className="px-4 py-3 font-medium">Parking</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {buildings.map((building, index) => (
                                            <tr key={building.buildingId} className={index === 0 ? "bg-white" : "border-t border-zinc-200 bg-white"}>
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-zinc-950">{building.buildingName}</div>
                                                    <div className="mt-1 text-xs text-zinc-500">{building.vacantUnits} vacant</div>
                                                </td>
                                                <td className="px-4 py-4 font-medium text-zinc-700">{formatCompactNumber(building.totalUnits)}</td>
                                                <td className="px-4 py-4">
                                                    <div className="font-medium text-zinc-950">{formatPercent(building.occupancyRate)}</div>
                                                    <div className="mt-2 h-2 w-full max-w-32 rounded-full bg-zinc-100">
                                                        <div
                                                            className="h-full rounded-full bg-emerald-600"
                                                            style={{ width: `${Math.max(Math.min(building.occupancyRate, 100), 0)}%` }}
                                                        />
                                                    </div>
                                                    <div className="mt-2 text-xs text-zinc-500">{building.occupiedUnits} occupied</div>
                                                </td>
                                                <td className="px-4 py-4 text-zinc-700">{formatCompactNumber(building.activeLeases)}</td>
                                                <td className="px-4 py-4 text-zinc-700">{formatCompactNumber(building.openMaintenanceRequests)}</td>
                                                <td className="px-4 py-4 text-zinc-700">
                                                    {formatCompactNumber(building.activeParkingAllocations)}
                                                    <div className="mt-1 text-xs text-zinc-500">{building.parkingSlotsTotal} slots</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-[28px] border-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg text-zinc-950">Recent Activity</CardTitle>
                        <CardDescription>Latest {RECENT_ACTIVITY_LIMIT} operational events across maintenance, visitors, parking, broadcasts, and leases.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ActivityFeed items={activityItems} />
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
