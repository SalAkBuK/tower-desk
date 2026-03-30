import { hasPermission, hasPermissionPrefix } from "./permissions";

const hasRequestsWritePermission = (permissionSet: Set<string>) =>
    hasPermission(permissionSet, "requests.write")
    || hasPermissionPrefix(permissionSet, "requests.write");

export const canAssignRequests = (permissionSet: Set<string>) =>
    hasRequestsWritePermission(permissionSet)
    || hasPermission(permissionSet, "requests.assign")
    || hasPermissionPrefix(permissionSet, "requests.assign");

export const canUpdateRequestStatuses = (permissionSet: Set<string>) =>
    hasRequestsWritePermission(permissionSet)
    || hasPermission(permissionSet, "requests.update_status")
    || hasPermissionPrefix(permissionSet, "requests.update_status");

export const canCommentOnRequests = (permissionSet: Set<string>) =>
    hasRequestsWritePermission(permissionSet)
    || hasPermission(permissionSet, "requests.comment")
    || hasPermissionPrefix(permissionSet, "requests.comment");
