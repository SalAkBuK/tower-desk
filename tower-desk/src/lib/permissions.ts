import type { BaseRole, User } from "./types";

const normalizeKey = (value?: string | null) => {
    if (!value) return "";
    return String(value).trim().toLowerCase();
};

export const buildPermissionSet = (keys: Array<string | null | undefined>) => {
    const set = new Set<string>();
    keys.forEach((key) => {
        const normalized = normalizeKey(key);
        if (normalized) {
            set.add(normalized);
        }
    });
    return set;
};

const ROLE_FALLBACK_PERMISSIONS: Partial<Record<BaseRole, string[]>> = {
    service_provider: [
        "dashboard.read",
        "requests.write",
    ],
    owner: [
        "owner.access",
    ],
    manager: [
        "requests.write",
        "residents.read",
        "contracts.write",
        "contracts.move_requests.review",
        "contracts.move_requests.execute",
        "occupancy.read",
        "visitors.read",
        "messaging.write",
        "broadcasts.write",
        "buildings.read",
        "units.read",
        "parkingslots.read",
        "users.write",
        "reports.read",
    ],
    building_admin: [
        "requests.write",
        "residents.read",
        "contracts.write",
        "contracts.move_requests.review",
        "contracts.move_requests.execute",
        "occupancy.read",
        "visitors.read",
        "messaging.write",
        "broadcasts.write",
        "buildings.read",
        "units.read",
        "parkingslots.read",
        "users.write",
        "reports.read",
    ],
};

const shouldUseRolePermissionFallback = (user?: User | null) => {
    if (!user?.baseRole) return false;
    if ((user.effectivePermissions?.length ?? 0) > 0) return false;
    return Boolean(ROLE_FALLBACK_PERMISSIONS[user.baseRole]);
};

export const getUserEffectivePermissionSet = (user?: User | null) => {
    if (shouldUseRolePermissionFallback(user)) {
        return buildPermissionSet(ROLE_FALLBACK_PERMISSIONS[user?.baseRole as BaseRole] ?? []);
    }
    return buildPermissionSet(user?.effectivePermissions ?? []);
};

export const getUserPermissionSet = (user?: User | null) => {
    if (shouldUseRolePermissionFallback(user)) {
        return buildPermissionSet(ROLE_FALLBACK_PERMISSIONS[user?.baseRole as BaseRole] ?? []);
    }
    return buildPermissionSet(user?.effectivePermissions ?? []);
};

export const hasPermission = (permissionSet: Set<string>, key?: string | null) => {
    const normalized = normalizeKey(key);
    if (!normalized) return false;
    return permissionSet.has("*") || permissionSet.has(normalized);
};

export const hasPermissionPrefix = (permissionSet: Set<string>, prefix?: string | null) => {
    const normalized = normalizeKey(prefix);
    if (!normalized) return false;
    if (permissionSet.has("*") || permissionSet.has(normalized)) return true;
    const prefixToken = `${normalized}.`;
    for (const entry of permissionSet) {
        if (entry.startsWith(prefixToken)) return true;
    }
    return false;
};

export const hasAnyPermission = (
    permissionSet: Set<string>,
    options?: { keys?: string[]; prefixes?: string[] }
) => {
    if (permissionSet.has("*")) return true;
    const keys = options?.keys ?? [];
    const prefixes = options?.prefixes ?? [];
    for (const key of keys) {
        if (hasPermission(permissionSet, key)) return true;
    }
    for (const prefix of prefixes) {
        if (hasPermissionPrefix(permissionSet, prefix)) return true;
    }
    return false;
};
