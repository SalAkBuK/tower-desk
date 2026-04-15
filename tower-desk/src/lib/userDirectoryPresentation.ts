import { getPresentableScopeLabel, normalizeAccessDisplayLabel } from "./opaqueIdentifiers";
import { formatRoleLabel, toCanonicalRole } from "./roles";
import { getUserAccessView } from "./userAccess";
import type { User } from "./types";

export type UserDirectoryTab = "management_staff" | "residents" | "pending_setup" | "inactive";
export type ManagementStaffFilter = "all" | "org_wide" | "building_scoped" | "mixed";

export type UserDirectoryStatus = {
    label: "Active" | "Pending setup" | "Inactive";
    tone: string;
};

export type UserDirectorySummary = {
    status: UserDirectoryStatus;
    tab: UserDirectoryTab;
    filter: ManagementStaffFilter;
    primaryAccess: string;
    scope: string;
    detailOrgRoles: string[];
    detailBuildingAssignments: string[];
    detailResidentLink?: string;
    detailSetupState: string;
};

const getBuildingName = (buildingId?: string | null, buildingNameById?: Record<string, string>) => {
    const normalizedId = String(buildingId ?? "").trim();
    if (!normalizedId) return undefined;
    return getPresentableScopeLabel(buildingNameById?.[normalizedId], normalizedId);
};

const formatBuildingAssignmentLabel = (
    assignment: ReturnType<typeof getUserAccessView>["buildingAccess"][number],
    buildingNameById?: Record<string, string>
) => {
    const buildingName = getPresentableScopeLabel(getBuildingName(assignment.scopeId, buildingNameById), assignment.buildingName);
    const roleLabel = normalizeAccessDisplayLabel(assignment.roleTemplateName ?? formatRoleLabel(assignment.roleTemplateKey)) ?? "Access";
    return [roleLabel, buildingName].filter(Boolean).join(" - ");
};

const formatResidentScope = (
    resident: ReturnType<typeof getUserAccessView>["resident"],
    buildingNameById?: Record<string, string>
) => {
    if (!resident) return "No resident scope";
    const buildingName = getBuildingName(resident.buildingId, buildingNameById) ?? resident.buildingName;
    const parts = [buildingName, resident.unitLabel].filter(Boolean);
    return parts.length > 0 ? parts.join(" / ") : "Resident access";
};

const getPrimaryBuildingAccessLabel = (user: User) => {
    const canonicalRole = toCanonicalRole(user.baseRole ?? user.role);
    if (canonicalRole === "building_admin") return "Building Admin";
    if (canonicalRole === "manager") return "Building Manager";
    if (canonicalRole === "employee") return "Building Staff";
    return undefined;
};

export const getUserDirectoryStatus = (user: User): UserDirectoryStatus => {
    if (user.isActive === false) {
        return { label: "Inactive", tone: "bg-rose-50 text-rose-700" };
    }
    if (user.mustChangePassword) {
        return { label: "Pending setup", tone: "bg-amber-50 text-amber-700" };
    }
    return { label: "Active", tone: "bg-emerald-50 text-emerald-700" };
};

export const getUserDirectorySummary = (
    user: User,
    buildingNameById?: Record<string, string>
): UserDirectorySummary => {
    const access = getUserAccessView(user);
    const status = getUserDirectoryStatus(user);
    const hasOrgAccess = access.orgAccess.length > 0;
    const hasBuildingAccess = access.buildingAccess.length > 0;
    const hasResident = Boolean(access.resident);

    const tab: UserDirectoryTab =
        status.label === "Inactive"
            ? "inactive"
            : status.label === "Pending setup"
                ? "pending_setup"
                : hasResident && !hasOrgAccess && !hasBuildingAccess
                    ? "residents"
                    : "management_staff";

    const filter: ManagementStaffFilter =
        hasOrgAccess && (hasBuildingAccess || hasResident)
            ? "mixed"
            : hasBuildingAccess && hasResident
                ? "mixed"
                : hasOrgAccess
                    ? "org_wide"
                    : hasBuildingAccess
                        ? "building_scoped"
                        : "all";

    let primaryAccess = "User";
    let scope = "No access scope";

    if (hasOrgAccess) {
        const primaryOrgLabel =
            normalizeAccessDisplayLabel(access.primaryOrgAccess?.roleName)
            ?? normalizeAccessDisplayLabel(access.orgAccess[0]?.roleTemplateName)
            ?? normalizeAccessDisplayLabel(formatRoleLabel(access.orgAccess[0]?.roleTemplateKey));
        primaryAccess = primaryOrgLabel ?? "Org Access";
        if (hasBuildingAccess) {
            scope = access.buildingAccess.length === 1
                ? `Org-wide + ${getBuildingName(access.buildingAccess[0]?.scopeId, buildingNameById) ?? "1 building"}`
                : `Org-wide + ${access.buildingAccess.length} buildings`;
        } else if (hasResident) {
            scope = `Org-wide + ${formatResidentScope(access.resident, buildingNameById)}`;
        } else {
            scope = "Org-wide";
        }
    } else if (hasBuildingAccess) {
        primaryAccess =
            normalizeAccessDisplayLabel(access.buildingAccess[0]?.roleTemplateName)
            ?? getPrimaryBuildingAccessLabel(user)
            ?? normalizeAccessDisplayLabel(formatRoleLabel(access.buildingAccess[0]?.roleTemplateKey))
            ?? "Building Access";
        scope = access.buildingAccess.length === 1
            ? (getBuildingName(access.buildingAccess[0]?.scopeId, buildingNameById) ?? "1 building")
            : `${access.buildingAccess.length} buildings`;
    } else if (hasResident) {
        primaryAccess = "Resident";
        scope = formatResidentScope(access.resident, buildingNameById);
    }

    return {
        status,
        tab,
        filter,
        primaryAccess,
        scope,
        detailOrgRoles: access.orgAccess.map((assignment) =>
            normalizeAccessDisplayLabel(assignment.roleTemplateName ?? formatRoleLabel(assignment.roleTemplateKey)) ?? "Org Access"
        ),
        detailBuildingAssignments: access.buildingAccess.map((assignment) =>
            formatBuildingAssignmentLabel(assignment, buildingNameById)
        ),
        detailResidentLink: hasResident ? formatResidentScope(access.resident, buildingNameById) : undefined,
        detailSetupState:
            status.label === "Pending setup"
                ? "Invite sent, setup still pending."
                : status.label === "Inactive"
                    ? "User access is inactive."
                    : "User can access the system.",
    };
};
