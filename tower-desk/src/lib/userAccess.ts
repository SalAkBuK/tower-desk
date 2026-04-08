import type {
    AccessAssignment,
    BaseRole,
    CurrentUserAccess,
    PermissionOverride,
    RoleDefinition,
    User,
    UserBuildingAssignment,
    UserDisplay,
    UserDisplayBadge,
    UserOrgAccess,
    UserResidentLink,
} from "./types";
import { formatRoleLabel, isPrimaryOrgAccessRoleDefinition, toCanonicalRole } from "./roles";

type NormalizeUserOptions = {
    fallbackId?: string;
    fallbackEmail?: string;
    fallbackName?: string;
};

export type UserAccessView = {
    orgAccess: AccessAssignment[];
    buildingAccess: AccessAssignment[];
    primaryOrgAccess: UserOrgAccess | null;
    buildingAssignments: UserBuildingAssignment[];
    resident: UserResidentLink | null;
    displayLabel?: string;
    displayBadges: UserDisplayBadge[];
    effectivePermissions: string[];
    permissionOverrides: PermissionOverride[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const asString = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
};

const asNullableString = (value: unknown) => {
    if (value === null) return null;
    return asString(value);
};

const normalizeStringArray = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return Array.from(
        new Set(
            value
                .map((entry) => asString(entry))
                .filter((entry): entry is string => Boolean(entry))
        )
    );
};

export const sortUniqueStrings = (value: unknown) =>
    normalizeStringArray(value).sort((a, b) => a.localeCompare(b));

export function normalizeRoleDefinitions(entries: unknown): RoleDefinition[] {
    if (!Array.isArray(entries)) return [];
    return entries
        .map((entry) => {
            if (!isRecord(entry)) return null;
            return {
                id: asString(entry.id ?? entry.roleId ?? entry._id ?? entry.key ?? entry.name ?? ""),
                key: asString(entry.key ?? entry.name ?? entry.id ?? ""),
                name: asString(entry.name ?? entry.displayName ?? entry.key) ?? "Role",
                description: asString(entry.description ?? entry.desc),
                permissionKeys: normalizeStringArray(entry.permissionKeys ?? entry.permissions ?? entry.perms),
            };
        })
        .filter((role): role is NonNullable<typeof role> => Boolean(role?.id))
        .map((role) => ({
            id: role.id as string,
            key: role.key ?? (role.id as string),
            name: role.name,
            description: role.description,
            permissionKeys: role.permissionKeys,
        }));
}

const badgeFromLabel = (label?: string, key?: string, tone?: string): UserDisplayBadge | null => {
    if (!label) return null;
    return { key, label, tone };
};

const normalizeDisplayBadge = (value: unknown): UserDisplayBadge | null => {
    if (typeof value === "string") {
        return badgeFromLabel(value, value);
    }
    if (!isRecord(value)) return null;
    return badgeFromLabel(
        asString(value.label ?? value.name ?? value.text ?? value.title ?? value.type ?? value.key),
        asString(value.key ?? value.id ?? value.type ?? value.code),
        asString(value.tone ?? value.variant ?? value.color)
    );
};

const normalizeDisplayBadges = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    const badges = value
        .map(normalizeDisplayBadge)
        .filter((entry): entry is UserDisplayBadge => Boolean(entry));
    const seen = new Set<string>();
    return badges.filter((badge) => {
        const key = `${badge.key ?? badge.label}:${badge.label}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const normalizePermissionOverrides = (value: unknown): PermissionOverride[] => {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            if (!isRecord(entry)) return null;
            const permissionKey = asString(entry.permissionKey ?? entry.key ?? entry.permission);
            const effectRaw = asString(entry.effect ?? entry.mode ?? entry.type)?.toUpperCase();
            if (!permissionKey || (effectRaw !== "ALLOW" && effectRaw !== "DENY")) return null;
            return { permissionKey, effect: effectRaw } as PermissionOverride;
        })
        .filter((entry): entry is PermissionOverride => Boolean(entry));
};

const assignmentTypeToBaseRole = (value?: string): BaseRole | undefined => {
    const normalized = asString(value)?.toUpperCase();
    if (normalized === "BUILDING_ADMIN") return "building_admin";
    if (normalized === "MANAGER") return "manager";
    if (normalized === "STAFF") return "employee";
    return undefined;
};

const assignmentTypeLabel = (value?: string) => {
    const normalized = asString(value)?.toUpperCase();
    if (normalized === "BUILDING_ADMIN") return "Building assignment";
    if (normalized === "MANAGER") return "Manager";
    if (normalized === "STAFF") return "Staff";
    return formatRoleLabel(value);
};

const assignmentTypeToRoleTemplateKey = (value?: string) => {
    const normalized = asString(value)?.toUpperCase();
    if (normalized === "BUILDING_ADMIN") return "building_admin";
    if (normalized === "MANAGER") return "building_manager";
    if (normalized === "STAFF") return "building_staff";
    return asString(value);
};

const roleTemplateKeyToAssignmentType = (value?: string) => {
    const canonical = toCanonicalRole(value);
    if (canonical === "building_admin") return "BUILDING_ADMIN";
    if (canonical === "manager") return "MANAGER";
    if (canonical === "employee") return "STAFF";

    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "MANAGER";
    if (normalized.includes("building") && normalized.includes("admin")) return "BUILDING_ADMIN";
    if (normalized.includes("manager")) return "MANAGER";
    if (normalized.includes("staff")) return "STAFF";
    return String(value);
};

const normalizeAccessAssignment = (
    value: unknown,
    fallbackScopeType?: AccessAssignment["scopeType"]
): AccessAssignment | null => {
    if (!isRecord(value)) return null;
    const scope = isRecord(value.scope) ? value.scope : null;
    const building = isRecord(value.building) ? value.building : null;

    const scopeTypeRaw = asString(value.scopeType ?? scope?.type ?? fallbackScopeType)?.toUpperCase();
    const scopeType =
        scopeTypeRaw === "ORG"
            ? "ORG"
            : scopeTypeRaw === "BUILDING"
                ? "BUILDING"
                : fallbackScopeType;
    if (!scopeType) return null;

    const roleTemplateKey =
        asString(value.roleTemplateKey)
        ?? asString(value.roleKey ?? value.key ?? value.role)
        ?? assignmentTypeToRoleTemplateKey(asString(value.type ?? value.assignmentType));
    if (!roleTemplateKey) return null;

    const explicitScopeId = value.scopeId ?? scope?.id ?? value.buildingId ?? building?.id ?? null;
    const scopeId =
        scopeType === "ORG"
            ? asNullableString(explicitScopeId) ?? null
            : asString(explicitScopeId) ?? null;
    if (scopeType === "BUILDING" && !scopeId) return null;

    return {
        assignmentId: asString(value.assignmentId ?? value.id),
        roleId: asString(value.roleId ?? value.roleTemplateId),
        roleTemplateKey,
        roleTemplateName: asString(value.roleTemplateName ?? value.roleName ?? value.name ?? value.label ?? value.displayName),
        scopeType,
        scopeId,
        description: asString(value.description ?? value.scopeLabel ?? value.desc),
        buildingName: asString(value.buildingName ?? building?.name),
        permissionKeys: normalizeStringArray(value.permissionKeys ?? value.permissions ?? value.perms),
    };
};

const dedupeAccessAssignments = (entries: AccessAssignment[]) => {
    const seen = new Set<string>();
    return entries.filter((entry) => {
        const key = [
            entry.scopeType,
            entry.scopeId ?? "__org__",
            entry.roleTemplateKey,
            entry.assignmentId ?? "",
            entry.roleId ?? "",
        ].join(":");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const normalizeOrgAccessList = (value: unknown): AccessAssignment[] => {
    if (Array.isArray(value)) {
        return dedupeAccessAssignments(
            value
                .map((entry) => normalizeAccessAssignment(entry, "ORG"))
                .filter((entry): entry is AccessAssignment => Boolean(entry))
                .map((entry) => ({ ...entry, scopeType: "ORG", scopeId: null }))
        );
    }
    const normalized = normalizeAccessAssignment(value, "ORG");
    return normalized ? [{ ...normalized, scopeType: "ORG", scopeId: null }] : [];
};

const normalizeBuildingAccessList = (value: unknown): AccessAssignment[] => {
    if (!Array.isArray(value)) return [];
    return dedupeAccessAssignments(
        value
            .map((entry) => normalizeAccessAssignment(entry, "BUILDING"))
            .filter((entry): entry is AccessAssignment => Boolean(entry))
    );
};

const normalizeResidentLink = (value: unknown): UserResidentLink | null => {
    if (!isRecord(value)) return null;
    const building = isRecord(value.building) ? value.building : null;
    const unit = isRecord(value.unit) ? value.unit : null;
    const occupancy = isRecord(value.occupancy) ? value.occupancy : null;
    const normalized: UserResidentLink = {
        occupancyId: asString(value.occupancyId ?? occupancy?.id),
        buildingId: asString(value.buildingId ?? building?.id),
        buildingName: asString(value.buildingName ?? building?.name),
        unitId: asString(value.unitId ?? unit?.id),
        unitLabel: asString(value.unitLabel ?? unit?.label ?? unit?.unitLabel),
        status: asString(value.status ?? occupancy?.status),
        mode: asString(value.mode) as UserResidentLink["mode"],
    };
    if (!normalized.occupancyId && !normalized.buildingId && !normalized.unitId && !normalized.unitLabel) {
        return null;
    }
    return normalized;
};

const buildLegacyOrgAccess = (assignment: AccessAssignment): UserOrgAccess => ({
    roleId: assignment.roleId,
    roleKey: assignment.roleTemplateKey,
    roleName:
        assignment.roleTemplateName
        ?? formatRoleLabel(assignment.roleTemplateKey, toCanonicalRole(assignment.roleTemplateKey)),
    description: assignment.description,
});

const toLegacyOrgAccess = (
    raw: Record<string, unknown>,
    baseRole?: BaseRole,
    assignedRoles?: RoleDefinition[]
): UserOrgAccess | null => {
    const primaryOrgRole = assignedRoles?.find((role) => isPrimaryOrgAccessRoleDefinition(role));
    if (primaryOrgRole) {
        return {
            roleId: primaryOrgRole.id,
            roleKey: primaryOrgRole.key,
            roleName: primaryOrgRole.name,
            description: primaryOrgRole.description,
        };
    }
    if (baseRole && !["superadmin", "admin", "org_admin"].includes(baseRole)) {
        return null;
    }
    const orgRoleKey = normalizeStringArray(raw.orgRoleKeys)[0];
    const roleKey = orgRoleKey ?? normalizeStringArray(raw.roleKeys)[0] ?? asString(raw.role ?? raw.baseRole);
    if (!roleKey) return null;
    return {
        roleId: asString(raw.roleId),
        roleKey,
        roleName: formatRoleLabel(roleKey, toCanonicalRole(roleKey)),
    };
};

const toLegacyOrgAccessList = (
    raw: Record<string, unknown>,
    baseRole?: BaseRole,
    assignedRoles?: RoleDefinition[]
): AccessAssignment[] => {
    const legacy = toLegacyOrgAccess(raw, baseRole, assignedRoles);
    if (!legacy?.roleKey) return [];
    return [
        {
            assignmentId: undefined,
            roleId: legacy.roleId,
            roleTemplateKey: legacy.roleKey,
            roleTemplateName: legacy.roleName,
            scopeType: "ORG",
            scopeId: null,
            description: legacy.description,
        },
    ];
};

const toLegacyBuildingAssignments = (raw: Record<string, unknown>, baseRole?: BaseRole): UserBuildingAssignment[] => {
    const assignmentRole =
        baseRole === "building_admin"
            ? "BUILDING_ADMIN"
            : baseRole === "manager"
                ? "MANAGER"
                : baseRole === "employee"
                    ? "STAFF"
                    : undefined;
    if (!assignmentRole) return [];
    const buildingIds = normalizeStringArray(raw.buildingIds ?? (raw.buildingId ? [raw.buildingId] : []));
    return buildingIds.map((buildingId) => ({
        buildingId,
        type: assignmentRole,
    }));
};

const toLegacyBuildingAccess = (raw: Record<string, unknown>, baseRole?: BaseRole): AccessAssignment[] =>
    toLegacyBuildingAssignments(raw, baseRole)
        .map((assignment) => ({
            assignmentId: assignment.id,
            roleTemplateKey: assignmentTypeToRoleTemplateKey(assignment.type) ?? assignment.type,
            roleTemplateName: formatRoleLabel(assignment.type),
            scopeType: "BUILDING" as const,
            scopeId: assignment.buildingId,
            description: assignment.description,
            buildingName: assignment.buildingName,
        }));

const toLegacyResidentLink = (raw: Record<string, unknown>, baseRole?: BaseRole): UserResidentLink | null => {
    if (baseRole !== "tenant") return null;
    const buildingId = asString(raw.buildingId) ?? normalizeStringArray(raw.buildingIds)[0];
    if (!buildingId) return { unitId: asString(raw.unitId), unitLabel: asString(raw.unitLabel) };
    return {
        buildingId,
        unitId: asString(raw.unitId),
        unitLabel: asString(raw.unitLabel),
    };
};

const toLegacyBuildingAssignment = (assignment: AccessAssignment): UserBuildingAssignment | null => {
    if (assignment.scopeType !== "BUILDING" || !assignment.scopeId) return null;
    return {
        id: assignment.assignmentId,
        buildingId: assignment.scopeId,
        buildingName: assignment.buildingName,
        type: roleTemplateKeyToAssignmentType(assignment.roleTemplateKey),
        description: assignment.description,
    };
};

const deriveDisplay = (
    rawDisplay: unknown,
    primaryOrgAccess: UserOrgAccess | null,
    buildingAssignments: UserBuildingAssignment[],
    resident: UserResidentLink | null,
    baseRole?: BaseRole
): UserDisplay | null => {
    const normalizedDisplay = isRecord(rawDisplay) ? rawDisplay : null;
    const primaryLabel =
        asString(normalizedDisplay?.primaryLabel ?? normalizedDisplay?.label ?? normalizedDisplay?.name)
        ?? primaryOrgAccess?.roleName
        ?? (baseRole ? formatRoleLabel(baseRole, baseRole) : undefined);

    const derivedBadges = [
        ...buildingAssignments.map((assignment) =>
            badgeFromLabel(
                [assignmentTypeLabel(assignment.type), assignment.buildingName ?? assignment.buildingId]
                    .filter(Boolean)
                    .join(" - "),
                `${assignment.type}:${assignment.buildingId}`
            )
        ),
        resident ? badgeFromLabel("Resident", "resident") : null,
    ].filter((entry): entry is UserDisplayBadge => Boolean(entry));

    const rawBadges = normalizeDisplayBadges(normalizedDisplay?.badges);
    const badges = rawBadges.length > 0 ? rawBadges : derivedBadges;

    if (!primaryLabel && badges.length === 0) return null;
    return {
        primaryLabel,
        badges,
    };
};

const deriveBaseRole = (
    raw: Record<string, unknown>,
    orgAccess: AccessAssignment[],
    buildingAccess: AccessAssignment[],
    resident: UserResidentLink | null
): BaseRole | undefined => {
    const explicitBaseRole = toCanonicalRole(asString(raw.baseRole));
    if (explicitBaseRole) return explicitBaseRole;

    const explicitRole = toCanonicalRole(asString(raw.role));
    if (explicitRole) return explicitRole;

    for (const assignment of orgAccess) {
        const orgAccessRole = toCanonicalRole(assignment.roleTemplateKey ?? assignment.roleTemplateName);
        if (orgAccessRole) return orgAccessRole;
    }
    if (orgAccess.length > 0) return "org_admin";

    for (const assignment of buildingAccess) {
        const assignmentRole = assignmentTypeToBaseRole(roleTemplateKeyToAssignmentType(assignment.roleTemplateKey));
        if (assignmentRole) return assignmentRole;
    }

    if (resident) return "tenant";
    return undefined;
};

const derivePrimaryOrgAccess = (
    orgAccess: AccessAssignment[],
    raw: Record<string, unknown>,
    baseRole?: BaseRole,
    assignedRoles?: RoleDefinition[]
) => {
    const primary = orgAccess[0];
    if (primary) return buildLegacyOrgAccess(primary);
    return toLegacyOrgAccess(raw, baseRole, assignedRoles);
};

export const getOrgAccessAssignments = (access: CurrentUserAccess | Partial<User> | null | undefined) =>
    Array.isArray(access?.orgAccess)
        ? access.orgAccess.filter((assignment): assignment is AccessAssignment => Boolean(assignment?.roleTemplateKey))
        : [];

export const getBuildingAccessAssignments = (access: CurrentUserAccess | Partial<User> | null | undefined) =>
    Array.isArray(access?.buildingAccess)
        ? access.buildingAccess.filter(
            (assignment): assignment is AccessAssignment =>
                Boolean(assignment?.roleTemplateKey && assignment.scopeId)
        )
        : [];

export function hasPermission(
    access: CurrentUserAccess | Partial<User> | null | undefined,
    permission: string
) {
    const normalizedPermission = String(permission ?? "").trim().toLowerCase();
    if (!normalizedPermission) return false;
    return Boolean(
        access?.effectivePermissions?.some((entry) => String(entry).trim().toLowerCase() === normalizedPermission)
    );
}

export function hasBuildingAssignment(
    access: CurrentUserAccess | Partial<User> | null | undefined,
    buildingId: string
) {
    const normalizedBuildingId = String(buildingId ?? "").trim();
    if (!normalizedBuildingId) return false;
    return getBuildingAccessAssignments(access).some((assignment) => assignment.scopeId === normalizedBuildingId);
}

export function hasBuildingRole(
    access: CurrentUserAccess | Partial<User> | null | undefined,
    buildingId: string,
    roleTemplateKey: string
) {
    const normalizedBuildingId = String(buildingId ?? "").trim();
    const normalizedRoleTemplateKey = String(roleTemplateKey ?? "").trim().toLowerCase();
    if (!normalizedBuildingId || !normalizedRoleTemplateKey) return false;
    return getBuildingAccessAssignments(access).some(
        (assignment) =>
            assignment.scopeId === normalizedBuildingId
            && String(assignment.roleTemplateKey).trim().toLowerCase() === normalizedRoleTemplateKey
    );
}

export function hasOrgRole(
    access: CurrentUserAccess | Partial<User> | null | undefined,
    roleTemplateKey: string
) {
    const normalizedRoleTemplateKey = String(roleTemplateKey ?? "").trim().toLowerCase();
    if (!normalizedRoleTemplateKey) return false;
    return getOrgAccessAssignments(access).some(
        (assignment) =>
            String(assignment.roleTemplateKey).trim().toLowerCase() === normalizedRoleTemplateKey
    );
}

export const hasOrgScopedAccess = (access: CurrentUserAccess | Partial<User> | null | undefined) =>
    getOrgAccessAssignments(access).length > 0;

export const hasBuildingScopedAccess = (access: CurrentUserAccess | Partial<User> | null | undefined) =>
    getBuildingAccessAssignments(access).length > 0;

export const isBuildingScopedOnlyAccess = (access: CurrentUserAccess | Partial<User> | null | undefined) =>
    hasBuildingScopedAccess(access) && !hasOrgScopedAccess(access);

export const isBuildingScopedOnly = (
    access: CurrentUserAccess | Partial<User> | null | undefined,
    permission?: string
) => {
    if (permission && !hasPermission(access, permission)) return false;
    return isBuildingScopedOnlyAccess(access);
};

export function getUserAccessView(user: Partial<User> | null | undefined): UserAccessView {
    const normalized = user ? normalizeUserFromApi(user) ?? user : user;
    const orgAccess = getOrgAccessAssignments(normalized);
    const buildingAccess = getBuildingAccessAssignments(normalized);
    const primaryOrgAccess =
        normalized?.primaryOrgAccess
        ?? (orgAccess[0] ? buildLegacyOrgAccess(orgAccess[0]) : null);
    const buildingAssignments = Array.isArray(normalized?.buildingAssignments)
        ? normalized.buildingAssignments
        : buildingAccess
            .map(toLegacyBuildingAssignment)
            .filter((entry): entry is UserBuildingAssignment => Boolean(entry));
    const resident = normalized?.resident ?? null;
    const displayBadges = Array.isArray(normalized?.display?.badges) ? normalized.display.badges : [];
    return {
        orgAccess,
        buildingAccess,
        primaryOrgAccess,
        buildingAssignments,
        resident,
        displayLabel: normalized?.display?.primaryLabel,
        displayBadges,
        effectivePermissions: sortUniqueStrings(normalized?.effectivePermissions),
        permissionOverrides: Array.isArray(normalized?.permissionOverrides) ? normalized.permissionOverrides : [],
    };
}

export function normalizeUserFromApi(rawValue: unknown, options?: NormalizeUserOptions): User | null {
    if (!isRecord(rawValue)) return null;

    const assignedRoles = normalizeRoleDefinitions(rawValue.assignedRoles ?? rawValue.roles);
    const rawOrgAccess = normalizeOrgAccessList(rawValue.orgAccess);
    const rawBuildingAccess = normalizeBuildingAccessList(rawValue.buildingAccess ?? rawValue.buildingAssignments);
    const roleKeys = normalizeStringArray(rawValue.roleKeys);
    const orgRoleKeys = normalizeStringArray(rawValue.orgRoleKeys);
    const effectivePermissions = sortUniqueStrings(
        rawValue.effectivePermissions ?? rawValue.permissions ?? rawValue.perms
    );
    const canonicalResident = normalizeResidentLink(rawValue.resident);
    const baseRoleSeed = deriveBaseRole(rawValue, rawOrgAccess, rawBuildingAccess, canonicalResident);

    const orgAccess = rawOrgAccess.length > 0
        ? rawOrgAccess
        : toLegacyOrgAccessList(rawValue, baseRoleSeed, assignedRoles);
    const buildingAccess = rawBuildingAccess.length > 0
        ? rawBuildingAccess
        : toLegacyBuildingAccess(rawValue, baseRoleSeed);
    const resident = canonicalResident ?? toLegacyResidentLink(rawValue, baseRoleSeed);
    const baseRole = deriveBaseRole(rawValue, orgAccess, buildingAccess, resident);
    const primaryOrgAccess = derivePrimaryOrgAccess(orgAccess, rawValue, baseRole, assignedRoles);
    const buildingAssignments = buildingAccess
        .map(toLegacyBuildingAssignment)
        .filter((entry): entry is UserBuildingAssignment => Boolean(entry));
    const display = deriveDisplay(rawValue.display, primaryOrgAccess, buildingAssignments, resident, baseRole);
    const permissionOverrides = normalizePermissionOverrides(rawValue.permissionOverrides ?? rawValue.overrides);

    const id =
        asString(rawValue.id ?? rawValue.userId ?? rawValue._id)
        ?? options?.fallbackId;
    if (!id) return null;

    const email = asString(rawValue.email) ?? options?.fallbackEmail ?? "";
    const fullName =
        asString(rawValue.fullName)
        ?? ([asString(rawValue.firstName), asString(rawValue.lastName)].filter(Boolean).join(" ") || undefined);
    const name =
        asString(rawValue.name)
        ?? fullName
        ?? display?.primaryLabel
        ?? options?.fallbackName
        ?? (email ? email.split("@")[0] : "User");
    const buildingIds = Array.from(
        new Set([
            ...normalizeStringArray(rawValue.buildingIds),
            ...buildingAccess
                .map((assignment) => assignment.scopeId)
                .filter((scopeId): scopeId is string => Boolean(scopeId)),
            ...(resident?.buildingId ? [resident.buildingId] : []),
        ])
    );
    const displayRole =
        asString(rawValue.role)
        ?? primaryOrgAccess?.roleKey
        ?? baseRole
        ?? "user";

    return {
        id,
        name,
        email,
        role: displayRole,
        baseRole,
        avatarUrl: asString(rawValue.avatarUrl ?? rawValue.avatar ?? rawValue.photoUrl),
        buildingIds,
        orgId: asNullableString(rawValue.orgId),
        orgRoleKeys,
        roleKeys,
        assignedRoles,
        effectivePermissions,
        orgAccess,
        buildingAccess,
        primaryOrgAccess,
        buildingAssignments,
        resident,
        display,
        permissionOverrides,
        isActive: typeof rawValue.isActive === "boolean" ? rawValue.isActive : undefined,
        mustChangePassword:
            typeof rawValue.mustChangePassword === "boolean"
                ? rawValue.mustChangePassword
                : (typeof rawValue.must_change_password === "boolean" ? rawValue.must_change_password : undefined),
        fullName,
        phoneNumber: asString(rawValue.phoneNumber ?? rawValue.phone),
        address: asString(rawValue.address),
        nationality: asString(rawValue.nationality),
        createdAt: asString(rawValue.createdAt ?? rawValue.created_at),
    };
}
