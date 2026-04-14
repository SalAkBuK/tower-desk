"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
    Bell,
    Building2,
    Car,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    Home,
    KeyRound,
    LayoutDashboard,
    LayoutGrid,
    LogOut,
    Megaphone,
    MessageCircle,
    Settings,
    ShieldCheck,
    Star,
    UserCheck,
    UserRound,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useOrgProfile } from "@/lib/queries";
import { getUserPermissionSet, hasAnyPermission } from "@/lib/permissions";
import { normalizeToPortalPath } from "@/lib/portalPaths";
import { getPortalModuleByKey, getPortalNavigationModules, type PortalModuleDefinition } from "@/lib/portalRegistry";
import { isManagementActionableRequest } from "@/lib/requestQueueManagement";
import { formatRoleLabel, isOrganizationAdminRole } from "@/lib/roles";
import {
    useAccessibleBuildings,
    useAdminRequests,
    useConversations,
    useOwnerConversationUnreadCount,
    useOwnerNotificationUnreadCount,
    useOwnerRequestCommentUnreadCount,
    usePendingContractMoveRequestsCount,
    useProviderRequestUnreadCount,
    useProviderRuntimeContext,
} from "@/lib/queries";

interface SidebarItem {
    key: string;
    label: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
    rule?: {
        keys?: string[];
        prefixes?: string[];
    };
}

interface SidebarProps {
    collapsed?: boolean;
    allowCollapse?: boolean;
    onToggleCollapse?: () => void;
}

function getIdentityMark(orgName: string) {
    const words = orgName.split(/\s+/).filter(Boolean);
    const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase() ?? "").join("");
    return initials || "TD";
}

function SidebarSectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
    if (collapsed) {
        return <div className="mx-auto h-px w-8 bg-zinc-200/80" aria-hidden="true" />;
    }

    return (
        <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            {label}
        </div>
    );
}

export function Sidebar({ collapsed = false, allowCollapse = false, onToggleCollapse }: SidebarProps = {}) {
    const pathname = usePathname();
    const { role, baseRole, logout, user } = useAuth();
    const isProviderPortal = baseRole === "service_provider";
    const isOwnerPortal = baseRole === "owner";
    const { data: orgProfile } = useOrgProfile({ enabled: Boolean(baseRole && baseRole !== "superadmin" && !isProviderPortal && !isOwnerPortal) });
    const orgName = isOwnerPortal ? "TowerDesk Owner" : isProviderPortal ? "TowerDesk Provider" : (orgProfile?.name || "TowerDesk");
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
    const providerRuntimeContextQuery = useProviderRuntimeContext({ enabled: isProviderPortal });
    const providerAccess = providerRuntimeContextQuery.data?.providers ?? [];
    const hasSingleProviderContext = providerAccess.length === 1;

    const canAccess = (item: SidebarItem) => {
        if (item.key === "owners" && isOrganizationAdminRole(baseRole)) {
            return true;
        }
        if (
            isProviderPortal
            && (item.key === "provider-profile" || item.key === "provider-staff")
            && !hasSingleProviderContext
        ) {
            return false;
        }
        if (!item.rule) return true;
        return hasAnyPermission(permissionSet, item.rule);
    };

    const prefix = baseRole === "superadmin" ? "/platform" : "/portal";
    const normalizedPathname = normalizeToPortalPath(pathname);
    const shouldLoadAccessibleBuildings = !isProviderPortal && !isOwnerPortal && (canReadRequests || canReadContracts || canReadMessages);
    const accessibleBuildingsQuery = useAccessibleBuildings(user?.id, baseRole, { enabled: shouldLoadAccessibleBuildings });
    const accessibleBuildingIds = (accessibleBuildingsQuery.data ?? []).map((building) => building.id);
    const providerUnreadCountQuery = useProviderRequestUnreadCount({
        enabled: isProviderPortal && canReadRequests && hasSingleProviderContext,
    });
    const ownerRequestUnreadCountQuery = useOwnerRequestCommentUnreadCount({
        enabled: isOwnerPortal && canReadRequests,
    });
    const ownerConversationUnreadCountQuery = useOwnerConversationUnreadCount({
        enabled: isOwnerPortal && canReadMessages,
    });
    const ownerNotificationUnreadCountQuery = useOwnerNotificationUnreadCount({
        enabled: isOwnerPortal,
    });
    const contractRequestsCountQuery = usePendingContractMoveRequestsCount(accessibleBuildingIds, {
        enabled:
            baseRole !== "superadmin"
            && baseRole !== "tenant"
            && !isProviderPortal
            && !isOwnerPortal
            && canReadContracts
            && accessibleBuildingIds.length > 0,
    });
    const conversationsQuery = useConversations({
        limit: 100,
        enabled: baseRole !== "superadmin" && baseRole !== "tenant" && !isProviderPortal && !isOwnerPortal && canReadMessages,
    });
    const requestsQuery = useAdminRequests(accessibleBuildingIds, {
        enabled:
            baseRole !== "superadmin"
            && baseRole !== "tenant"
            && !isProviderPortal
            && !isOwnerPortal
            && canReadRequests
            && accessibleBuildingIds.length > 0,
    });
    const contractRequestsBadgeCount = contractRequestsCountQuery.data ?? 0;
    const messagesBadgeCount = isOwnerPortal
        ? (ownerConversationUnreadCountQuery.data ?? 0)
        : (conversationsQuery.data?.items ?? []).reduce(
            (count, item) => count + (item.unreadCount ?? 0),
            0
        );
    const requestsBadgeCount = isOwnerPortal
        ? (ownerRequestUnreadCountQuery.data ?? 0)
        : isProviderPortal
            ? (providerUnreadCountQuery.data ?? 0)
            : (requestsQuery.data ?? []).reduce((count, item) => count + (isManagementActionableRequest(item) ? 1 : 0), 0);
    const notificationsBadgeCount = ownerNotificationUnreadCountQuery.data ?? 0;

    const iconBySegment: Record<string, ComponentType<{ className?: string }>> = {
        dashboard: LayoutDashboard,
        requests: ClipboardList,
        profile: UserRound,
        staff: Users,
        residents: UserRound,
        contracts: FileText,
        occupancy: Home,
        visitors: UserCheck,
        messages: MessageCircle,
        notifications: Bell,
        broadcasts: Megaphone,
        buildings: Building2,
        amenities: Star,
        units: LayoutGrid,
        parking: Car,
        owners: KeyRound,
        users: Users,
        permissions: ShieldCheck,
    };

    const toSidebarItem = (module: PortalModuleDefinition): SidebarItem => ({
        key: module.key,
        label: module.label,
        href: `${prefix}/${module.segment}`,
        icon: iconBySegment[module.segment] ?? Settings,
        badge:
            module.key === "requests"
                ? requestsBadgeCount
                : module.key === "notifications"
                    ? notificationsBadgeCount
                    : module.key === "contracts"
                        ? contractRequestsBadgeCount
                        : module.key === "messages"
                            ? messagesBadgeCount
                            : undefined,
        rule: module.rule,
    });

    const superadminItems: SidebarItem[] = [
        { key: "orgs", label: "Organizations", href: "/platform/orgs", icon: Building2 },
        { key: "delivery-tasks", label: "Delivery Tasks", href: "/platform/delivery-tasks", icon: ClipboardList, rule: { keys: ["platform.delivery_tasks.read"] } },
        { key: "permissions", label: "Permissions", href: "/platform/permissions", icon: ShieldCheck },
    ];

    const mainItems = baseRole === "superadmin"
        ? superadminItems.filter(canAccess)
        : getPortalNavigationModules("main", baseRole).map(toSidebarItem).filter(canAccess);

    const settingsItems = baseRole === "superadmin"
        ? []
        : getPortalNavigationModules("settings", baseRole).map(toSidebarItem).filter(canAccess);

    const allItems = [...mainItems, ...settingsItems];
    const activeItem = allItems.find((item) => normalizedPathname.startsWith(item.href));
    const defaultItem = mainItems[0];
    const activeHref = activeItem?.href ?? defaultItem?.href ?? "";
    const isSettingsRouteActive = settingsItems.some((item) => normalizedPathname.startsWith(item.href));
    const collapseTitle = collapsed ? "Expand sidebar" : "Collapse sidebar";
    const identityMark = getIdentityMark(orgName);

    useEffect(() => {
        if (isSettingsRouteActive) setSettingsOpen(true);
    }, [isSettingsRouteActive]);

    const renderBadge = (badge?: number, rail = false) => {
        if (typeof badge !== "number" || badge <= 0) return null;
        const display = badge > 99 ? "99+" : badge;

        if (rail) {
            return (
                <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm ring-2 ring-white">
                    {display}
                </span>
            );
        }

        return (
            <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 px-2 py-0.5 text-xs font-semibold text-white shadow-sm">
                {display}
            </span>
        );
    };

    const renderNavItem = (item: SidebarItem, indent = false) => {
        const Icon = item.icon;
        const isActive = activeHref === item.href;

        if (collapsed) {
            return (
                <Link
                    key={item.href}
                    href={item.href}
                    aria-label={item.label}
                    title={item.label}
                    className={cn(
                        "relative flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200",
                        isActive
                            ? "border-emerald-200 bg-emerald-50 text-zinc-950 shadow-sm ring-1 ring-emerald-100"
                            : "border-transparent text-slate-500 hover:border-zinc-200 hover:bg-white hover:text-slate-900"
                    )}
                >
                    <Icon className={cn("h-4 w-4", isActive ? "text-emerald-700" : "text-slate-500")} />
                    {renderBadge(item.badge, true)}
                </Link>
            );
        }

        return (
            <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    indent && "ml-4",
                    isActive
                        ? "bg-emerald-50 text-zinc-950 shadow-sm ring-1 ring-emerald-100"
                        : "text-slate-600 hover:bg-white hover:text-slate-900"
                )}
            >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-emerald-700" : "text-slate-400 group-hover:text-slate-600")} />
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="truncate">{item.label}</span>
                    {renderBadge(item.badge)}
                </span>
            </Link>
        );
    };

    return (
        <aside
            className={cn(
                "flex h-full w-full flex-col border-r border-zinc-200 bg-[linear-gradient(180deg,#fafafa_0%,#ffffff_22%,#ffffff_100%)] text-slate-700",
                collapsed ? "px-3 py-4" : "px-4 py-5"
            )}
        >
            <div className={cn("border-b border-zinc-200/80 pb-4", collapsed ? "space-y-3" : "space-y-4")}>
                <div className={cn("flex gap-3", collapsed ? "flex-col items-center" : "items-start justify-between")}>
                    <div className={cn("flex gap-3", collapsed ? "flex-col items-center" : "items-start")}>
                        <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-sm font-semibold tracking-[0.16em] text-zinc-700 shadow-sm"
                            title={orgName}
                            aria-label={orgName}
                        >
                            {identityMark}
                        </div>
                        {!collapsed ? (
                            <div className="min-w-0">
                                <div className="truncate text-lg font-semibold tracking-tight text-slate-950">{orgName}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                                        {roleLabel}
                                    </span>
                                    {activeItem ? (
                                        <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                            {activeItem.label}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {allowCollapse ? (
                        <button
                            type="button"
                            onClick={onToggleCollapse}
                            aria-label={collapseTitle}
                            title={collapseTitle}
                            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-slate-900"
                        >
                            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </button>
                    ) : null}
                </div>

                {!collapsed ? (
                    <p className="text-sm leading-6 text-zinc-500">
                        Navigate your workspace with clearer sections, live badges, and persistent context.
                    </p>
                ) : null}
            </div>

            <nav className={cn("flex-1 overflow-y-auto", collapsed ? "pt-4" : "pt-5")}>
                <div className={cn("space-y-3", collapsed && "space-y-4")}>
                    <SidebarSectionLabel label="Main" collapsed={collapsed} />
                    <div className={cn("space-y-1", collapsed && "flex flex-col items-center gap-2 space-y-0")}>
                        {mainItems.map((item) => renderNavItem(item))}
                    </div>
                </div>

                {settingsItems.length > 0 ? (
                    <div className={cn("mt-5 space-y-3", collapsed && "mt-6 space-y-4")}>
                        <SidebarSectionLabel label="Settings" collapsed={collapsed} />

                        {collapsed ? (
                            <div className="flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSettingsOpen(true);
                                        onToggleCollapse?.();
                                    }}
                                    aria-label="Show settings"
                                    title="Show settings"
                                    className={cn(
                                        "flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200",
                                        isSettingsRouteActive
                                            ? "border-emerald-200 bg-emerald-50 text-zinc-950 shadow-sm ring-1 ring-emerald-100"
                                            : "border-transparent text-slate-500 hover:border-zinc-200 hover:bg-white hover:text-slate-900"
                                    )}
                                >
                                    <Settings className={cn("h-4 w-4", isSettingsRouteActive ? "text-emerald-700" : "text-slate-500")} />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <button
                                    type="button"
                                    onClick={() => setSettingsOpen((value) => !value)}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                        isSettingsRouteActive
                                            ? "bg-zinc-100 text-slate-900"
                                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Settings className="h-4 w-4 text-slate-400" />
                                        Settings
                                    </div>
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 text-slate-400 transition-transform duration-200",
                                            settingsOpen && "rotate-180"
                                        )}
                                    />
                                </button>

                                {settingsOpen ? (
                                    <div className="space-y-1">
                                        {settingsItems.map((item) => renderNavItem(item, true))}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : null}
            </nav>

            <div className={cn("border-t border-zinc-200/80 pt-4", collapsed ? "mt-4" : "mt-5")}>
                {!collapsed ? (
                    <div className="px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                        Account
                    </div>
                ) : null}
                <Button
                    variant="ghost"
                    title="Sign Out"
                    aria-label="Sign Out"
                    className={cn(
                        "h-11 rounded-2xl text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600",
                        collapsed ? "w-11 justify-center px-0" : "w-full justify-start px-3"
                    )}
                    onClick={() => logout()}
                >
                    <LogOut className={cn("h-4 w-4", collapsed ? "" : "mr-2")} />
                    {!collapsed ? "Sign Out" : null}
                </Button>
            </div>
        </aside>
    );
}
