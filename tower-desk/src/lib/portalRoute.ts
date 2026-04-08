import type { BaseRole, User } from "./types";
import { getUserPermissionSet, hasAnyPermission } from "./permissions";
import { canAccessPortalRole } from "./roles";
import {
    canAccessPortalModule,
    extractPortalSlug,
    findFirstAccessiblePortalModule,
    getPortalModuleByKey,
    matchPortalRoute,
    SUPERADMIN_SEGMENTS,
} from "./portalRegistry";

type PermissionRule = {
    keys?: string[];
    prefixes?: string[];
};

export type PortalResolutionReason =
    | "missing_role"
    | "portal_blocked_role"
    | "superadmin_home"
    | "superadmin_route"
    | "no_module_access"
    | "unknown_module"
    | "forbidden_module"
    | "alias_route"
    | "module_home"
    | "module_route";

export type PortalResolution = {
    destination: string;
    reason: PortalResolutionReason;
    segment?: string;
};

const normalizeSlug = (slug?: string[]) => {
    return (slug ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
};

export function resolvePortalRoute({
    user,
    baseRole,
    slug,
}: {
    user?: User | null;
    baseRole?: BaseRole;
    slug?: string[];
}): PortalResolution {
    if (!baseRole) {
        return { destination: "/login", reason: "missing_role" };
    }
    if (!canAccessPortalRole(baseRole)) {
        return { destination: "/login?reason=mobile-app-only", reason: "portal_blocked_role" };
    }

    const normalizedSlug = normalizeSlug(slug);

    if (baseRole === "superadmin") {
        if (normalizedSlug.length === 0) {
            return { destination: "/sa/orgs", reason: "superadmin_home" };
        }
        const [segment] = normalizedSlug;
        if (!SUPERADMIN_SEGMENTS.has(segment)) {
            return { destination: "/403", reason: "unknown_module", segment };
        }
        return {
            destination: `/sa/${normalizedSlug.join("/")}`,
            reason: "superadmin_route",
            segment,
        };
    }

    const permissionSet = getUserPermissionSet(user);
    if (normalizedSlug.length === 0) {
        const allowedModule = findFirstAccessiblePortalModule(permissionSet, baseRole);
        if (!allowedModule) {
            return { destination: "/403", reason: "no_module_access" };
        }
        return {
            destination: `/portal/${allowedModule.segment}`,
            reason: "module_home",
            segment: allowedModule.segment,
        };
    }

    const match = matchPortalRoute(normalizedSlug);
    const [segment] = normalizedSlug;
    if (!match) {
        return { destination: "/403", reason: "unknown_module", segment };
    }
    const moduleEntry = getPortalModuleByKey(match.route.moduleKey);
    if (
        !moduleEntry
        || (moduleEntry.allowedRoles && !moduleEntry.allowedRoles.includes(baseRole))
        || !canAccessPortalModule(permissionSet, moduleEntry.key, baseRole)
    ) {
        return { destination: "/403", reason: "forbidden_module", segment };
    }
    if (match.route.redirectTo) {
        return {
            destination: `/portal/${match.route.redirectTo.join("/")}`,
            reason: "alias_route",
            segment,
        };
    }

    return {
        destination: `/portal/${normalizedSlug.join("/")}`,
        reason: "module_route",
        segment,
    };
}

export const resolvePortalRouteFromPath = ({
    pathname,
    user,
    baseRole,
}: {
    pathname?: string | null;
    user?: User | null;
    baseRole?: BaseRole;
}) => {
    const slug = extractPortalSlug(pathname);
    if (slug === null) return null;
    return resolvePortalRoute({ user, baseRole, slug });
};
