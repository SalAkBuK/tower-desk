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
import { useState } from "react";

export function Topbar() {
    const { user, logout } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { data, isLoading } = useNotifications({ limit: 10 });
    const markRead = useMarkNotificationRead();
    const markAllRead = useMarkAllNotificationsRead();
    const notifications = data?.items ?? [];
    const unreadCount = notifications.filter((item) => !item.readAt).length;
    const hasUnread = unreadCount > 0;

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
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative text-zinc-400 hover:text-zinc-600">
                            <Bell className="w-5 h-5" />
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
                        <DropdownMenuItem onClick={() => logout()} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <ProfileSheet open={isProfileOpen} onOpenChange={setIsProfileOpen} />
        </header>
    );
}
