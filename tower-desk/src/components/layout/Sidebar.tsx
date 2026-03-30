"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useOrgProfile } from "@/lib/queries";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { normalizeToPortalPath } from "@/lib/portalPaths";
import { getPortalNavigationModules, type PortalModuleDefinition } from "@/lib/portalRegistry";
import { formatRoleLabel } from "@/lib/roles";
import {
    Building2,
    Users,
    UserRound,
    ClipboardList,
    ShieldCheck,
    Home,
    LogOut,
    Car,
    LayoutGrid,
    Settings,
    ChevronDown,
    UserCheck,
    Megaphone,
    MessageCircle,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, type ComponentType } from "react";

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    rule?: {
        keys?: string[];
        prefixes?: string[];
    };
}

export function Sidebar() {
    const pathname = usePathname();
    const { role, baseRole, logout, user } = useAuth();
    const { data: orgProfile } = useOrgProfile({ enabled: Boolean(baseRole && baseRole !== 'superadmin') });
    const orgName = orgProfile?.name || "TowerDesk";
    const [settingsOpen, setSettingsOpen] = useState(true);

    const roleLabel = role ? formatRoleLabel(role, baseRole) : "Guest";

    const permissionSet = getUserPermissionSet(user);

    const canAccess = (item: SidebarItem) => {
        if (!item.rule) return true;
        return hasAnyPermission(permissionSet, item.rule);
    };

    const getRoutePrefix = () => {
        if (baseRole === 'superadmin') return '/sa';
        return '/portal';
    };

    const prefix = getRoutePrefix();
    const normalizedPathname = normalizeToPortalPath(pathname);

    const iconBySegment: Record<string, ComponentType<{ className?: string }>> = {
        requests: ClipboardList,
        residents: UserRound,
        contracts: FileText,
        occupancy: Home,
        visitors: UserCheck,
        messages: MessageCircle,
        broadcasts: Megaphone,
        buildings: Building2,
        units: LayoutGrid,
        parking: Car,
        users: Users,
        permissions: ShieldCheck,
    };

    const toSidebarItem = (module: PortalModuleDefinition): SidebarItem => ({
        label: module.label,
        href: `${prefix}/${module.segment}`,
        icon: iconBySegment[module.segment] ?? Settings,
        rule: module.rule,
    });

    // Superadmin has different navigation
    const superadminItems: SidebarItem[] = [
        { label: 'Organizations', href: '/sa/orgs', icon: Building2 },
        { label: 'Permissions', href: '/sa/permissions', icon: ShieldCheck },
    ];

    const getMainItems = (): SidebarItem[] => {
        if (baseRole === 'superadmin') return superadminItems;
        return getPortalNavigationModules("main", baseRole).map(toSidebarItem).filter(canAccess);
    };

    const getSettingsItems = (): SidebarItem[] => {
        if (baseRole === 'superadmin') return [];
        return getPortalNavigationModules("settings", baseRole).map(toSidebarItem).filter(canAccess);
    };

    const mainItems = getMainItems();
    const settingsItems = getSettingsItems();
    const allItems = [...mainItems, ...settingsItems];
    const activeItem = allItems.find((item) => normalizedPathname.startsWith(item.href));
    const defaultItem = mainItems.find((item) => item.href === `${prefix}/requests`) ?? mainItems[0];
    const activeHref = activeItem?.href ?? defaultItem?.href ?? "";

    const renderNavItem = (item: SidebarItem, indent = false) => {
        const Icon = item.icon;
        const isActive = activeHref === item.href;

        return (
            <Link
                key={item.href}
                href={item.href}
                className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    indent && "ml-4",
                    isActive
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                )}
            >
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-slate-400")} />
                {item.label}
            </Link>
        );
    };

    return (
        <div className="flex flex-col h-full w-64 bg-gradient-to-b from-slate-50 to-white text-slate-700 border-r border-slate-200">
            <div className="p-6">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    {orgName}
                </h1>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{roleLabel}</p>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                {/* Main navigation items */}
                {mainItems.map((item) => renderNavItem(item))}

                {/* Settings collapsible group */}
                {settingsItems.length > 0 && (
                    <div className="pt-2">
                        <button
                            onClick={() => setSettingsOpen(!settingsOpen)}
                            className={cn(
                                "flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                                "text-slate-600 hover:text-slate-900 hover:bg-white/80"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Settings className="w-4 h-4 text-slate-400" />
                                Settings
                            </div>
                            <ChevronDown
                                className={cn(
                                    "w-4 h-4 text-slate-400 transition-transform duration-200",
                                    settingsOpen && "rotate-180"
                                )}
                            />
                        </button>
                        {settingsOpen && (
                            <div className="mt-1 space-y-1">
                                {settingsItems.map((item) => renderNavItem(item, true))}
                            </div>
                        )}
                    </div>
                )}
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
