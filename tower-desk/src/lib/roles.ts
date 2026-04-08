import type { BaseRole, RoleDefinition, User } from "./types";

const ROLE_LABELS: Record<BaseRole, string> = {
    superadmin: "Superadmin",
    admin: "Admin",
    org_admin: "Org Admin",
    building_admin: "Building Admin",
    manager: "Manager",
    service_provider: "Service Provider",
    owner: "Owner",
    employee: "Maintenance Staff",
    tenant: "Tenant",
};

export const normalizeRoleKey = (value?: string | null) =>
    String(value ?? "").trim().toLowerCase().replace(/[\s-_]/g, "");

export const toCanonicalRole = (value?: string | null): BaseRole | undefined => {
    const normalized = normalizeRoleKey(value);
    if (!normalized) return undefined;
    if (["superadmin", "super", "superuser", "platformadmin", "platform", "root", "towerdesk"].includes(normalized)) {
        return "superadmin";
    }
    if (["orgadmin", "organizationadmin", "orgowner"].includes(normalized)) {
        return "org_admin";
    }
    if (["buildingadmin", "buildingadministrator"].includes(normalized)) {
        return "building_admin";
    }
    if (["admin"].includes(normalized)) {
        return "admin";
    }
    if (["owner", "propertyowner"].includes(normalized)) {
        return "owner";
    }
    if (["manager", "buildingmanager"].includes(normalized)) {
        return "manager";
    }
    if (["serviceprovider", "service_provider"].includes(normalized)) {
        return "service_provider";
    }
    if (["employee", "staff", "buildingstaff", "maintenance", "maintenancestaff", "technician", "worker"].includes(normalized)) {
        return "employee";
    }
    if (["tenant", "resident", "occupant"].includes(normalized)) {
        return "tenant";
    }
    return undefined;
};

export const getCanonicalRole = (user?: Pick<User, "role" | "baseRole"> | null) =>
    user?.baseRole ?? toCanonicalRole(user?.role);

export const hasCanonicalRole = (
    subject: Pick<User, "role" | "baseRole"> | string | null | undefined,
    role: BaseRole
) => {
    if (!subject) return false;
    if (typeof subject === "string") {
        return toCanonicalRole(subject) === role;
    }
    return getCanonicalRole(subject) === role;
};

export const hasAnyCanonicalRole = (
    subject: Pick<User, "role" | "baseRole"> | string | null | undefined,
    roles: BaseRole[]
) => roles.some((role) => hasCanonicalRole(subject, role));

export const isOrganizationAdminRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) =>
    hasAnyCanonicalRole(subject, ["admin", "org_admin"]);

export const isBuildingAdminRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) =>
    hasCanonicalRole(subject, "building_admin");

export const isBuildingScopedPortalRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) =>
    hasAnyCanonicalRole(subject, ["building_admin", "manager"]);

export const isBuildingScopedManagementRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) =>
    hasAnyCanonicalRole(subject, ["admin", "org_admin", "building_admin", "manager"]);

export const isManagementDisplayRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) =>
    hasAnyCanonicalRole(subject, ["admin", "org_admin", "building_admin", "manager"]);

export const canAccessPortalRole = (subject?: Pick<User, "role" | "baseRole"> | string | null) => {
    if (!subject) return false;
    const role = typeof subject === "string" ? toCanonicalRole(subject) : getCanonicalRole(subject);
    return Boolean(role && role !== "tenant");
};

export const isAssignableOrgAccessRoleKey = (value?: string | null) => {
    const normalized = normalizeRoleKey(value);
    if (!normalized) return false;
    if (normalized === "viewer") return true;
    const canonical = toCanonicalRole(value);
    if (!canonical) return true;
    return canonical === "org_admin";
};

export const isPrimaryOrgAccessRoleDefinition = (
    role?: Pick<RoleDefinition, "key" | "name"> | null
) => {
    if (!role) return false;
    return isAssignableOrgAccessRoleKey(role.key ?? role.name);
};

export const formatRoleLabel = (role?: string | null, canonicalRole?: BaseRole | null) => {
    const resolvedRole = canonicalRole ?? toCanonicalRole(role);
    if (resolvedRole && ROLE_LABELS[resolvedRole]) {
        return ROLE_LABELS[resolvedRole];
    }

    const source = String(role ?? "").trim();
    if (!source) return "Unknown";

    return source
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const getRoleLabelMap = () => ROLE_LABELS;
