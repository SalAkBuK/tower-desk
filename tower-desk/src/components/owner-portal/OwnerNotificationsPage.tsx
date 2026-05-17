"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, EyeOff, Eye, Filter } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { getBroadcastNotificationMetadata, getBroadcastScopeLabel } from "@/lib/broadcastMetadata";
import type { NotificationItem } from "@/lib/types";
import {
    useDismissOwnerNotification,
    useMarkAllOwnerNotificationsRead,
    useMarkOwnerNotificationRead,
    useOwnerNotificationUnreadCount,
    useOwnerNotifications,
    useUndismissOwnerNotification,
} from "@/lib/queries";
import { getNotificationHref } from "@/lib/notificationLinks";

const EMPTY_NOTIFICATIONS: NotificationItem[] = [];

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const getOwnerNotificationPresentation = (notification: NotificationItem) => {
    const type = String(notification.type ?? "").toUpperCase();
    if (type === "OWNER_MAINTENANCE_NOTICE") {
        return {
            label: "Maintenance notice",
            badgeClassName: "bg-sky-50 text-sky-700",
            iconClassName: "bg-sky-50 text-sky-700",
            openLabel: "View request",
        };
    }
    if (type === "OWNER_APPROVAL_REQUESTED") {
        return {
            label: "Approval required",
            badgeClassName: "bg-amber-50 text-amber-800",
            iconClassName: "bg-amber-50 text-amber-700",
            openLabel: "Review",
        };
    }
    return {
        label: notification.type ? String(notification.type) : null,
        badgeClassName: "bg-zinc-100 text-zinc-700",
        iconClassName: "bg-zinc-100 text-zinc-500",
        openLabel: "Open",
    };
};

export function OwnerNotificationsPage() {
    const router = useRouter();
    const { baseRole } = useAuth();
    const enabled = baseRole === "owner";
    const [typeFilter, setTypeFilter] = useState("");
    const [limit, setLimit] = useState("20");
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [includeDismissed, setIncludeDismissed] = useState(false);

    const notificationsQuery = useOwnerNotifications({
        unreadOnly,
        includeDismissed,
        type: typeFilter || undefined,
        limit: Number(limit) || 20,
        enabled,
    });
    const unreadCountQuery = useOwnerNotificationUnreadCount({ enabled });
    const markRead = useMarkOwnerNotificationRead();
    const markAllRead = useMarkAllOwnerNotificationsRead();
    const dismissNotification = useDismissOwnerNotification();
    const undismissNotification = useUndismissOwnerNotification();

    const notifications = notificationsQuery.data?.items ?? EMPTY_NOTIFICATIONS;
    const knownTypes = useMemo(() => {
        return Array.from(new Set(notifications.map((item) => item.type).filter(Boolean))).sort();
    }, [notifications]);

    const handleMarkAllRead = async () => {
        try {
            await markAllRead.mutateAsync();
            toast.success("All notifications marked as read");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to mark all notifications as read");
        }
    };

    const handleToggleDismissed = async (notificationId: string, dismissedAt?: string | null) => {
        try {
            if (dismissedAt) {
                await undismissNotification.mutateAsync(notificationId);
                toast.success("Notification restored");
            } else {
                await dismissNotification.mutateAsync(notificationId);
                toast.success("Notification dismissed");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update notification");
        }
    };

    const handleOpenNotification = (notificationId: string, href: string | null, readAt?: string | null) => {
        if (!href) return;
        if (!readAt) {
            markRead.mutate(notificationId);
        }
        router.push(href);
    };

    if (baseRole !== "owner") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to owner users.</div>;
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Owner notifications</h1>
                        <p className="mt-2 text-sm text-zinc-500">
                            Notifications use the owner cursor stream and unread-count endpoint instead of local badge math from a partial page.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge className="bg-blue-50 text-blue-700">{unreadCountQuery.data ?? 0} unread</Badge>
                        <Button onClick={handleMarkAllRead} disabled={markAllRead.isPending || notifications.length === 0}>
                            Mark all read
                        </Button>
                    </div>
                </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="grid gap-3 md:grid-cols-4">
                    <div className="md:col-span-2">
                        <Input value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} placeholder="Filter by notification type" />
                    </div>
                    <Select value={limit} onValueChange={setLimit}>
                        <SelectTrigger><SelectValue placeholder="Page size" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly((current) => !current)}>
                            <Filter className="mr-2 h-4 w-4" />
                            Unread only
                        </Button>
                        <Button type="button" variant={includeDismissed ? "default" : "outline"} onClick={() => setIncludeDismissed((current) => !current)}>
                            {includeDismissed ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                            Dismissed
                        </Button>
                    </div>
                </div>
                {knownTypes.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {knownTypes.map((type) => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => setTypeFilter(typeFilter === type ? "" : type)}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${typeFilter === type ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                ) : null}
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="space-y-3">
                    {(notificationsQuery.isLoading && notifications.length === 0) ? (
                        <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">Loading owner notifications...</div>
                    ) : notifications.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">No notifications match the current filter.</div>
                    ) : notifications.map((item) => {
                        const href = getNotificationHref(item);
                        const broadcastMetadata = getBroadcastNotificationMetadata(item);
                        const presentation = getOwnerNotificationPresentation(item);
                        return (
                        <div
                            key={item.id}
                            role={href ? "button" : undefined}
                            tabIndex={href ? 0 : undefined}
                            onClick={href ? () => handleOpenNotification(item.id, href, item.readAt) : undefined}
                            onKeyDown={href ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    handleOpenNotification(item.id, href, item.readAt);
                                }
                            } : undefined}
                            className={`rounded-2xl border border-zinc-200 p-4 ${href ? "cursor-pointer transition hover:border-zinc-300 hover:bg-zinc-50/40" : ""}`}
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex items-start gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${presentation.iconClassName}`}>
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-sm font-semibold text-zinc-950">{item.title}</div>
                                            {!item.readAt ? <Badge className="bg-blue-50 text-blue-700">Unread</Badge> : null}
                                            {item.dismissedAt ? <Badge className="bg-zinc-100 text-zinc-700">Dismissed</Badge> : null}
                                            {presentation.label ? <Badge className={presentation.badgeClassName}>{presentation.label}</Badge> : null}
                                        </div>
                                        <p className="mt-1 text-sm text-zinc-600">{item.body ?? "No notification body."}</p>
                                        {broadcastMetadata ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge className="bg-blue-50 text-blue-700">{broadcastMetadata.audienceSummary}</Badge>
                                                <Badge className="bg-zinc-100 text-zinc-700">{getBroadcastScopeLabel(broadcastMetadata.scope)}</Badge>
                                                <Badge className="bg-zinc-100 text-zinc-700">
                                                    {broadcastMetadata.buildingCount} building{broadcastMetadata.buildingCount === 1 ? "" : "s"}
                                                </Badge>
                                            </div>
                                        ) : null}
                                        <p className="mt-2 text-xs text-zinc-400">{formatDate(item.createdAt)}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {!item.readAt ? (
                                        <Button
                                            variant="outline"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                markRead.mutate(item.id);
                                            }}
                                            disabled={markRead.isPending}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Mark read
                                        </Button>
                                    ) : null}
                                    {href ? (
                                        <Button
                                            variant="outline"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleOpenNotification(item.id, href, item.readAt);
                                            }}
                                        >
                                            {presentation.openLabel}
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="outline"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            handleToggleDismissed(item.id, item.dismissedAt);
                                        }}
                                        disabled={dismissNotification.isPending || undismissNotification.isPending}
                                    >
                                        {item.dismissedAt ? "Undismiss" : "Dismiss"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )})}
                </div>
            </section>
        </div>
    );
}
