import type { User } from "./types";

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

export const getUserEffectivePermissionSet = (user?: User | null) => {
    return buildPermissionSet(user?.effectivePermissions ?? []);
};

export const getUserPermissionSet = (user?: User | null) => {
    return buildPermissionSet([
        ...(user?.effectivePermissions ?? []),
        ...(user?.roleKeys ?? []),
        ...(user?.orgRoleKeys ?? []),
    ]);
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
