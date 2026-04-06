import type { CurrentUserAccess, User } from "./types";
import {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    hasBuildingAssignment,
    hasBuildingRole,
    hasOrgRole,
    hasPermission,
    isBuildingScopedOnly,
} from "./userAccess";

export type AccessSubject = CurrentUserAccess | Partial<User> | null | undefined;

export {
    getBuildingAccessAssignments,
    getOrgAccessAssignments,
    hasBuildingAssignment,
    hasBuildingRole,
    hasOrgRole,
    hasPermission,
    isBuildingScopedOnly,
};
