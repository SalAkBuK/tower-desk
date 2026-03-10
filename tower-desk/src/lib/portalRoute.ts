import type { BaseRole, User } from "./types";
import { getUserPermissionSet, hasAnyPermission } from "./permissions";

type PermissionRule = {
    keys?: string[];
    prefixes?: string[];
};

type PortalModule = {
    segment: string;
    rule: PermissionRule;
};

export type PortalResolutionReason =
    | "missing_role"
    | "superadmin_home"
    | "superadmin_route"
    | "no_module_access"
    | "unknown_module"
    | "forbidden_module"
    | "module_home"
    | "module_route";

export type PortalResolution = {
    destination: string;
    reason: PortalResolutionReason;
    segment?: string;
};

const PORTAL_MODULES: PortalModule[] = [
    { segment: "requests", rule: { prefixes: ["requests"] } },
    { segment: "residents", rule: { prefixes: ["residents"] } },
    { segment: "contracts", rule: { prefixes: ["contracts", "leases"] } },
    { segment: "leases", rule: { prefixes: ["leases"] } },
    { segment: "occupancy", rule: { prefixes: ["occupancy"] } },
    { segment: "visitors", rule: { prefixes: ["visitors"] } },
    { segment: "messages", rule: { prefixes: ["messaging"] } },
    { segment: "broadcasts", rule: { prefixes: ["broadcasts"] } },
    { segment: "buildings", rule: { prefixes: ["buildings"] } },
    { segment: "units", rule: { prefixes: ["units", "buildings"] } },
    { segment: "parking", rule: { prefixes: ["parkingSlots", "parkingAllocations", "vehicles"] } },
    { segment: "users", rule: { prefixes: ["users"] } },
    { segment: "permissions", rule: { prefixes: ["roles"] } },
    { segment: "access", rule: { prefixes: ["roles", "users", "building.assignments"] } },
    { segment: "reports", rule: { prefixes: ["reports"] } },
    { segment: "owners", rule: { prefixes: ["owners"] } },
];

const SUPERADMIN_SEGMENTS = new Set(["orgs", "permissions", "users", "requests", "buildings"]);

const resolvePortalPrefix = (baseRole?: BaseRole) => {
    if (!baseRole) return null;
    if (baseRole === "manager") return "manager";
    if (baseRole === "superadmin") return "sa";
    return "admin";
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

    const prefix = resolvePortalPrefix(baseRole);
    if (!prefix) {
        return { destination: "/403", reason: "missing_role" };
    }

    const permissionSet = getUserPermissionSet(user);
    if (normalizedSlug.length === 0) {
        const allowedModule = PORTAL_MODULES.find((module) =>
            hasAnyPermission(permissionSet, module.rule)
        );
        if (!allowedModule) {
            return { destination: "/403", reason: "no_module_access" };
        }
        return {
            destination: `/portal/${allowedModule.segment}`,
            reason: "module_home",
            segment: allowedModule.segment,
        };
    }

    const [segment] = normalizedSlug;
    const moduleEntry = PORTAL_MODULES.find((entry) => entry.segment === segment);
    if (!moduleEntry) {
        return { destination: "/403", reason: "unknown_module", segment };
    }
    if (!hasAnyPermission(permissionSet, moduleEntry.rule)) {
        return { destination: "/403", reason: "forbidden_module", segment };
    }

    return {
        destination: `/${prefix}/${normalizedSlug.join("/")}`,
        reason: "module_route",
        segment,
    };
}
