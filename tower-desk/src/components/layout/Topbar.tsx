"use client";

import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Bell, Loader2 } from "lucide-react";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/lib/queries";
import { ProfileSheet } from "@/components/profile/ProfileSheet";
import { OrgProfileSheet } from "@/components/orgs/OrgProfileSheet";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectNotificationsSocket, disconnectNotificationsSocket } from "@/lib/notificationsSocket";
import type { NotificationItem } from "@/lib/types";
import { toast } from "sonner";

type NotificationsQueryData = {
    items: NotificationItem[];
    nextCursor?: string | null;
};

type NotificationsQueryMeta = {
    unreadOnly: boolean;
    limit?: number;
};

const normalizeNotification = (payload: any): NotificationItem => {
    const createdAt = payload?.createdAt ?? payload?.created_at ?? payload?.timestamp;
    const readAt = payload?.readAt ?? payload?.read_at ?? null;
    return {
        id: String(payload?.id ?? payload?.notificationId ?? payload?._id ?? ''),
        type: payload?.type ?? payload?.eventType ?? '',
        title: payload?.title ?? payload?.subject ?? 'Notification',
        body: payload?.body ?? payload?.message ?? payload?.content,
        data: payload?.data ?? payload?.payload,
        readAt: readAt ? String(readAt) : null,
        createdAt: createdAt ? String(createdAt) : undefined,
    };
};

const updateNotificationQueries = (
    queryClient: ReturnType<typeof useQueryClient>,
    updater: (items: NotificationItem[], meta: NotificationsQueryMeta) => NotificationItem[],
) => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['notifications'] });
    queries.forEach((query) => {
        const queryKey = query.queryKey as unknown[];
        const unreadOnly = Boolean(queryKey[1]);
        const limit = typeof queryKey[3] === 'number' ? queryKey[3] : undefined;
        queryClient.setQueryData<NotificationsQueryData | undefined>(queryKey, (data) => {
            if (!data || !Array.isArray(data.items)) return data;
            return {
                ...data,
                items: updater(data.items, { unreadOnly, limit }),
            };
        });
    });
};

const hasNotificationId = (queryClient: ReturnType<typeof useQueryClient>, id: string) => {
    const queries = queryClient.getQueryCache().findAll({ queryKey: ['notifications'] });
    return queries.some((query) => {
        const data = queryClient.getQueryData<NotificationsQueryData | undefined>(query.queryKey);
        return data?.items?.some((item) => item.id === id);
    });
};

const insertNotification = (items: NotificationItem[], incoming: NotificationItem, limit?: number) => {
    const next = [incoming, ...items.filter((item) => item.id !== incoming.id)];
    if (limit && limit > 0) {
        return next.slice(0, limit);
    }
    return next;
};

export function Topbar() {
    const { user, token, logout, selectedOrgId, role } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isOrgProfileOpen, setIsOrgProfileOpen] = useState(false);
    const [bellPulse, setBellPulse] = useState(false);
    const bellTimeoutRef = useRef<number | null>(null);
    const baseTitleRef = useRef<string>('');
    const queryClient = useQueryClient();
    const isSuperadmin = role === 'superadmin';
    const { data, isLoading } = useNotifications({ limit: 10, enabled: !isSuperadmin });
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const notifications = data?.items ?? [];
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    const hasUnread = unreadCount > 0;
    const orgId = selectedOrgId ?? user?.orgId ?? null;
    const hasOrgContext = Boolean(orgId);

    useEffect(() => {
        if (isSuperadmin) return;
        if (typeof document === 'undefined') return;
        if (!baseTitleRef.current) {
            baseTitleRef.current = document.title || 'TowerDesk';
        }
        const baseTitle = baseTitleRef.current;
        document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
        return () => {
            document.title = baseTitle;
        };
    }, [unreadCount, isSuperadmin]);

    useEffect(() => {
        if (!token || isSuperadmin) {
            disconnectNotificationsSocket();
            return;
        }

        const socket = connectNotificationsSocket(token, orgId);
        if (!socket) {
            return;
        }

        const refreshNotifications = () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        };

        const triggerBell = () => {
            setBellPulse(false);
            requestAnimationFrame(() => setBellPulse(true));
            if (bellTimeoutRef.current) {
                window.clearTimeout(bellTimeoutRef.current);
            }
            bellTimeoutRef.current = window.setTimeout(() => {
                setBellPulse(false);
            }, 1200);
        };

        const handleNew = (payload: any) => {
            const incoming = normalizeNotification(payload);
            if (!incoming.id) return;
            const alreadySeen = hasNotificationId(queryClient, incoming.id);
            updateNotificationQueries(queryClient, (items, meta) => {
                if (meta.unreadOnly && incoming.readAt) return items;
                return insertNotification(items, incoming, meta.limit);
            });
            if (!alreadySeen) {
                toast(incoming.title || 'New notification', {
                    description: incoming.body || 'Open the bell to view details.',
                });
                triggerBell();
            }
        };

        const handleRead = (payload: { id?: string; readAt?: string | null }) => {
            if (!payload?.id) return;
            const nextReadAt = payload.readAt ? String(payload.readAt) : new Date().toISOString();
            updateNotificationQueries(queryClient, (items, meta) => {
                const nextItems = items.map((item) =>
                    item.id === String(payload.id) ? { ...item, readAt: nextReadAt } : item
                );
                return meta.unreadOnly ? nextItems.filter((item) => !item.readAt) : nextItems;
            });
        };

        const handleReadAll = (payload: { readAt?: string | null }) => {
            const nextReadAt = payload?.readAt ? String(payload.readAt) : new Date().toISOString();
            updateNotificationQueries(queryClient, (items, meta) => {
                if (meta.unreadOnly) return [];
                return items.map((item) => ({ ...item, readAt: nextReadAt }));
            });
        };

        socket.on('connect', refreshNotifications);
        socket.on('notifications:hello', refreshNotifications);
        socket.on('notifications:new', handleNew);
        socket.on('notifications:read', handleRead);
        socket.on('notifications:read_all', handleReadAll);

        return () => {
            socket.off('connect', refreshNotifications);
            socket.off('notifications:hello', refreshNotifications);
            socket.off('notifications:new', handleNew);
            socket.off('notifications:read', handleRead);
            socket.off('notifications:read_all', handleReadAll);
            disconnectNotificationsSocket();
            if (bellTimeoutRef.current) {
                window.clearTimeout(bellTimeoutRef.current);
                bellTimeoutRef.current = null;
            }
        };
    }, [token, queryClient, isSuperadmin, orgId]);

    return (
        <header className="h-16 px-6 border-b border-zinc-200 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-4">
            </div>

            <div className="flex items-center gap-4">
                {/* Global Search */}
                <div className="relative w-64 hidden md:block">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <Input
                        placeholder="Search..."
                        className="pl-9 bg-zinc-50 border-zinc-200 focus:bg-white transition-colors"
                    />
                </div>

                {/* Notifications */}
                {!isSuperadmin && hasOrgContext ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-zinc-600">
                                <Bell className={`w-5 h-5 ${bellPulse ? "bell-ring" : ""}`} />
                                {hasUnread ? (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                ) : null}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80">
                            <div className="flex items-center justify-between px-3 py-2">
                                <span className="text-sm font-semibold text-zinc-900">Notifications</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-zinc-500 hover:text-zinc-700"
                                    disabled={!hasUnread || markAllRead.isPending}
                                    onClick={() => markAllRead.mutate()}
                                >
                                    {markAllRead.isPending ? "Marking..." : "Mark all read"}
                                </Button>
                            </div>
                            <DropdownMenuSeparator />
                            <div className="max-h-80 overflow-auto">
                                {isLoading ? (
                                    <div className="flex items-center justify-center px-3 py-6 text-sm text-zinc-500">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading notifications...
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="px-3 py-6 text-center text-sm text-zinc-500">
                                        No notifications yet.
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <DropdownMenuItem
                                            key={notification.id}
                                            onSelect={() => {
                                                if (!notification.readAt) {
                                                    markRead.mutate(notification.id);
                                                }
                                            }}
                                            className={`flex flex-col items-start gap-1 py-3 ${notification.readAt ? "opacity-70" : ""}`}
                                        >
                                            <div className="flex w-full items-center justify-between gap-2">
                                                <span className="text-sm font-medium text-zinc-900">{notification.title}</span>
                                                <span className="text-[10px] text-zinc-400">
                                                    {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ""}
                                                </span>
                                            </div>
                                            {notification.body ? (
                                                <p className="text-xs text-zinc-500 line-clamp-2">{notification.body}</p>
                                            ) : null}
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}

                {/* User Profile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                            <Avatar className="h-9 w-9 border border-zinc-200">
                                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                                    {user?.name?.slice(0, 2).toUpperCase() || 'U'}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.name}</p>
                                <p className="text-xs leading-none text-zinc-500">{user?.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsProfileOpen(true)}>
                            Profile
                        </DropdownMenuItem>
                        {hasOrgContext ? (
                            <DropdownMenuItem onClick={() => setIsOrgProfileOpen(true)}>
                                Organization Profile
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <ProfileSheet open={isProfileOpen} onOpenChange={setIsProfileOpen} />
            <OrgProfileSheet open={isOrgProfileOpen} onOpenChange={setIsOrgProfileOpen} />
        </header>
    );
}
