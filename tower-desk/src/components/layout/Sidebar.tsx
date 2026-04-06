"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useOrgProfile } from "@/lib/queries";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { normalizeToPortalPath } from "@/lib/portalPaths";
import { getPortalModuleByKey, getPortalNavigationModules, type PortalModuleDefinition } from "@/lib/portalRegistry";
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
    LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, type ComponentType } from "react";
import { useAccessibleBuildings, useAdminRequests, useConversations, usePendingContractMoveRequestsCount } from "@/lib/queries";

interface SidebarItem {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
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

    const roleLabel =
        user?.display?.primaryLabel
        ?? user?.primaryOrgAccess?.roleName
        ?? (role ? formatRoleLabel(role, baseRole) : "Guest");

    const permissionSet = getUserPermissionSet(user);
    const requestsModuleRule = getPortalModuleByKey("requests")?.rule;
    const contractsModuleRule = getPortalModuleByKey("contracts")?.rule;
    const messagesModuleRule = getPortalModuleByKey("messages")?.rule;
    const canReadRequests = Boolean(requestsModuleRule && hasAnyPermission(permissionSet, requestsModuleRule));
    const canReadContracts = Boolean(contractsModuleRule && hasAnyPermission(permissionSet, contractsModuleRule));
    const canReadMessages = Boolean(messagesModuleRule && hasAnyPermission(permissionSet, messagesModuleRule));

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
    const shouldLoadAccessibleBuildings = canReadRequests || canReadContracts || canReadMessages;
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: shouldLoadAccessibleBuildings });
    const accessibleBuildingIds = (accessibleBuildingsQuery.data ?? []).map((building) => building.id);
    const contractRequestsCountQuery = usePendingContractMoveRequestsCount(accessibleBuildingIds, {
        enabled:
            baseRole !== "superadmin"
            && baseRole !== "tenant"
            && canReadContracts
            && accessibleBuildingIds.length > 0,
    });
    const conversationsQuery = useConversations({
        limit: 100,
        enabled: baseRole !== "superadmin" && baseRole !== "tenant" && canReadMessages,
    });
    const requestsQuery = useAdminRequests(accessibleBuildingIds, {
        enabled:
            baseRole !== "superadmin"
            && baseRole !== "tenant"
            && canReadRequests
            && accessibleBuildingIds.length > 0,
    });
    const contractRequestsBadgeCount = contractRequestsCountQuery.data ?? 0;
    const messagesBadgeCount = (conversationsQuery.data?.items ?? []).reduce(
        (count, item) => count + (item.unreadCount ?? 0),
        0
    );
    const requestsBadgeCount = (requestsQuery.data ?? []).reduce(
        (count, item) => count + (item.status === "pending" ? 1 : 0),
        0
    );

    const iconBySegment: Record<string, ComponentType<{ className?: string }>> = {
        dashboard: LayoutDashboard,
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
        badge:
            module.key === "requests"
                ? requestsBadgeCount
                : module.key === "contracts"
                ? contractRequestsBadgeCount
                : module.key === "messages"
                    ? messagesBadgeCount
                    : undefined,
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
    const defaultItem = mainItems[0];
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
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && item.badge !== null ? (
                            <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                                {item.badge > 99 ? "99+" : item.badge}
                            </span>
                        ) : null}
                    </span>
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
