"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useOrgProfile } from "@/lib/queries";
import {
    Building2,
    Users,
    ClipboardList,
    LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
}

export function Sidebar() {
    const pathname = usePathname();
    const { role, logout, user } = useAuth();
    const { data: orgProfile } = useOrgProfile({ enabled: Boolean(role && role !== 'superadmin') });
    const orgName = orgProfile?.name || "TowerDesk";
    const roleLabelMap: Record<string, string> = {
        superadmin: "Superadmin",
        admin: "Admin",
        org_admin: "Org Admin",
        manager: "Manager",
        service_provider: "Service Provider",
        employee: "Maintenance Staff",
        tenant: "Tenant",
    };
    const roleLabel = role ? (roleLabelMap[role] ?? role) : "Guest";

    const getItems = (): SidebarItem[] => {
        switch (role) {
            case 'superadmin':
                return [
                    { label: 'Organizations', href: '/sa/orgs', icon: Building2 },
                ];
            case 'admin':
            case 'org_admin':
                return [
                    { label: 'Requests', href: '/admin/requests', icon: ClipboardList },
                    { label: 'Buildings', href: '/admin/buildings', icon: Building2 },
                    { label: 'Users', href: '/admin/users', icon: Users },
                    { label: 'Owners', href: '/admin/owners', icon: Users },
                ];
            case 'manager':
                return [
                    { label: 'Buildings', href: '/manager/buildings', icon: Building2 },
                    { label: 'Requests', href: '/manager/requests', icon: ClipboardList },
                    { label: 'Users', href: '/manager/users', icon: Users },
                ];
            default:
                return [];
        }
    };

    const items = getItems();

    return (
        <div className="flex flex-col h-full w-64 bg-gradient-to-b from-slate-50 to-white text-slate-700 border-r border-slate-200">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {orgName}
                </h1>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{roleLabel}</p>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                            )}
                        >
                            <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-slate-400")} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-200">
                <Button
                    variant="ghost"
                    className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => logout()}
                >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                </Button>
            </div>
        </div>
    );
}
