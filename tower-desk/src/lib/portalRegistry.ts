import type { BaseRole } from "./types";
import { hasAnyPermission } from "./permissions";
import { normalizeToPortalPath } from "./portalPaths";

export type PermissionRule = {
    keys?: string[];
    prefixes?: string[];
};

export type PortalNavGroup = "main" | "settings" | null;
export type PortalVariant = "admin" | "manager";

export type PortalModuleDefinition = {
    key: string;
    segment: string;
    label: string;
    rule: PermissionRule;
    navGroup: PortalNavGroup;
    includeInHome?: boolean;
    allowedRoles?: BaseRole[];
};

export type PortalRouteDefinition = {
    id: string;
    segments: readonly string[];
    moduleKey: string;
    redirectTo?: readonly string[];
};

export type PortalRouteMatch = {
    route: PortalRouteDefinition;
    params: Record<string, string>;
};

export type PortalRenderDescriptor = {
    routeId: string;
    variant: PortalVariant;
    params: Record<string, string>;
};

const DYNAMIC_SEGMENT_PREFIX = ":";

export const PORTAL_MODULES: PortalModuleDefinition[] = [
    { key: "requests", segment: "requests", label: "Request", rule: { prefixes: ["requests"] }, navGroup: "main", includeInHome: true },
    { key: "residents", segment: "residents", label: "Tenants", rule: { prefixes: ["residents"] }, navGroup: "main", includeInHome: true },
    { key: "contracts", segment: "contracts", label: "Contracts", rule: { prefixes: ["contracts", "leases"] }, navGroup: "main", includeInHome: true },
    { key: "occupancy", segment: "occupancy", label: "Occupancy", rule: { prefixes: ["occupancy"] }, navGroup: "main", includeInHome: true },
    { key: "visitors", segment: "visitors", label: "Visitor", rule: { prefixes: ["visitors"] }, navGroup: "main", includeInHome: true },
    { key: "messages", segment: "messages", label: "Messages", rule: { prefixes: ["messaging"] }, navGroup: "main", includeInHome: true },
    { key: "broadcasts", segment: "broadcasts", label: "Broadcasts", rule: { prefixes: ["broadcasts"] }, navGroup: "main", includeInHome: true },
    { key: "buildings", segment: "buildings", label: "Building", rule: { prefixes: ["buildings"] }, navGroup: "settings", includeInHome: true },
    { key: "units", segment: "units", label: "Units", rule: { prefixes: ["units"] }, navGroup: "settings", includeInHome: true },
    { key: "parking", segment: "parking", label: "Parking", rule: { prefixes: ["parkingSlots", "parkingAllocations", "vehicles"] }, navGroup: "settings", includeInHome: true },
    { key: "users", segment: "users", label: "Users", rule: { prefixes: ["users"] }, navGroup: "settings", includeInHome: true },
    { key: "permissions", segment: "permissions", label: "Roles & Rights", rule: { prefixes: ["roles"] }, navGroup: "settings", includeInHome: true, allowedRoles: ["admin", "org_admin"] },
    { key: "access", segment: "access", label: "Access", rule: { prefixes: ["roles", "users", "building.assignments"] }, navGroup: null, includeInHome: true, allowedRoles: ["admin", "org_admin"] },
    { key: "reports", segment: "reports", label: "Reports", rule: { prefixes: ["reports"] }, navGroup: null, includeInHome: true },
];

export const PORTAL_ROUTES: PortalRouteDefinition[] = [
    { id: "requests-index", segments: ["requests"], moduleKey: "requests" },
    { id: "residents-index", segments: ["residents"], moduleKey: "residents" },
    { id: "contracts-index", segments: ["contracts"], moduleKey: "contracts" },
    { id: "contracts-move-in", segments: ["contracts", "move-in"], moduleKey: "contracts" },
    { id: "contracts-detail", segments: ["contracts", ":contractId"], moduleKey: "contracts" },
    { id: "leases-index", segments: ["leases"], moduleKey: "contracts" },
    { id: "leases-move-in", segments: ["leases", "move-in"], moduleKey: "contracts" },
    { id: "leases-detail", segments: ["leases", ":leaseId"], moduleKey: "contracts" },
    { id: "occupancy-index", segments: ["occupancy"], moduleKey: "occupancy" },
    { id: "visitors-index", segments: ["visitors"], moduleKey: "visitors" },
    { id: "messages-index", segments: ["messages"], moduleKey: "messages" },
    { id: "broadcasts-index", segments: ["broadcasts"], moduleKey: "broadcasts" },
    { id: "buildings-index", segments: ["buildings"], moduleKey: "buildings" },
    { id: "buildings-detail", segments: ["buildings", ":buildingId"], moduleKey: "buildings" },
    { id: "units-index", segments: ["units"], moduleKey: "units" },
    { id: "parking-index", segments: ["parking"], moduleKey: "parking" },
    { id: "users-index", segments: ["users"], moduleKey: "users" },
    { id: "permissions-index", segments: ["permissions"], moduleKey: "permissions" },
    { id: "access-index", segments: ["access"], moduleKey: "access" },
    { id: "reports-index", segments: ["reports"], moduleKey: "reports" },
    { id: "owners-alias", segments: ["owners"], moduleKey: "residents", redirectTo: ["residents"] },
];

export const SUPERADMIN_SEGMENTS = new Set(["orgs", "permissions", "users", "requests", "buildings"]);

export const getPortalModuleByKey = (key: string) =>
    PORTAL_MODULES.find((entry) => entry.key === key);

export const getPortalModuleBySegment = (segment?: string | null) =>
    PORTAL_MODULES.find((entry) => entry.segment === String(segment ?? "").trim().toLowerCase());

const roleAllowedForModule = (moduleEntry: PortalModuleDefinition, baseRole?: BaseRole) => {
    if (!moduleEntry.allowedRoles || moduleEntry.allowedRoles.length === 0) return true;
    if (!baseRole) return false;
    return moduleEntry.allowedRoles.includes(baseRole);
};

const isDynamicSegment = (segment: string) => segment.startsWith(DYNAMIC_SEGMENT_PREFIX);

const normalizeSlug = (slug?: string[]) =>
    (slug ?? [])
        .map((segment) => segment.trim().toLowerCase())
        .filter(Boolean);

export const extractPortalSlug = (pathname?: string | null) => {
    const normalizedPath = normalizeToPortalPath(pathname ?? "");
    if (!normalizedPath.startsWith("/portal")) return null;
    const suffix = normalizedPath.slice("/portal".length).replace(/^\/+/, "");
    if (!suffix) return [];
    return suffix.split("/").map((segment) => segment.trim()).filter(Boolean);
};

export const matchPortalRoute = (slug?: string[]): PortalRouteMatch | null => {
    const normalizedSlug = normalizeSlug(slug);
    for (const route of PORTAL_ROUTES) {
        if (route.segments.length !== normalizedSlug.length) continue;
        const params: Record<string, string> = {};
        let matches = true;
        route.segments.forEach((segment, index) => {
            const value = normalizedSlug[index];
            if (!matches) return;
            if (isDynamicSegment(segment)) {
                params[segment.slice(1)] = value;
                return;
            }
            if (segment !== value) {
                matches = false;
            }
        });
        if (matches) {
            return { route, params };
        }
    }
    return null;
};

export const findFirstAccessiblePortalModule = (permissionSet: Set<string>, baseRole?: BaseRole) => {
    return PORTAL_MODULES.find(
        (entry) =>
            entry.includeInHome !== false
            && roleAllowedForModule(entry, baseRole)
            && hasAnyPermission(permissionSet, entry.rule)
    );
};

export const canAccessPortalModule = (permissionSet: Set<string>, moduleKey: string, baseRole?: BaseRole) => {
    const moduleEntry = getPortalModuleByKey(moduleKey);
    if (!moduleEntry) return false;
    return roleAllowedForModule(moduleEntry, baseRole) && hasAnyPermission(permissionSet, moduleEntry.rule);
};

export const getPortalNavigationModules = (group: Exclude<PortalNavGroup, null>, baseRole?: BaseRole) =>
    PORTAL_MODULES.filter((entry) => entry.navGroup === group && roleAllowedForModule(entry, baseRole));

export const getPortalVariant = (baseRole?: BaseRole): PortalVariant =>
    baseRole === "manager" ? "manager" : "admin";

export const getPortalRenderDescriptor = (
    baseRole: BaseRole | undefined,
    slug?: string[]
): PortalRenderDescriptor | null => {
    const match = matchPortalRoute(slug);
    if (!match || !baseRole || baseRole === "superadmin") return null;
    return {
        routeId: match.route.id,
        variant: getPortalVariant(baseRole),
        params: match.params,
    };
};
