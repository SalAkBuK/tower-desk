import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../auth";
import {
    createRole,
    createUser,
    createUserAccessAssignment,
    deleteRole,
    deleteUser,
    deleteUserAccessAssignment,
    getEffectivePermissions,
    getPermissions,
    getRoleTemplates,
    getUserAccessAssignments,
    getUserPermissionOverrides,
    getUserRoles,
    getUsers,
    getUsersForAdminBuildings,
    provisionUser,
    setRolePermissions,
    setUserPermissionOverrides,
    setUserRoles,
    updateRoleTemplate,
} from "../api/users";
import type { RoleDefinition } from "../types";

const getAccessCatalogContextKey = () => {
    const { user, selectedOrgId } = useAuthStore.getState();
    return [
        user?.id ?? "anonymous",
        user?.baseRole ?? user?.role ?? "none",
        selectedOrgId ?? user?.orgId ?? "no-org",
    ] as const;
};

export function useUsers(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminUsers(buildingIds: string[], options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["admin-users", buildingIds],
        queryFn: () => getUsersForAdminBuildings(buildingIds),
        enabled: options?.enabled ?? buildingIds.length > 0,
    });
}

export function useSetUserPermissionOverrides() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, overrides }: { userId: string; overrides: { permissionKey: string; effect: "ALLOW" | "DENY" }[] }) =>
            setUserPermissionOverrides(userId, overrides),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}

export function useUserPermissionOverrides(userId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["user-permission-overrides", userId],
        queryFn: () => getUserPermissionOverrides(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useEffectivePermissions(userIds: string[], options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["effective-permissions", userIds],
        queryFn: () => getEffectivePermissions(userIds),
        enabled: options?.enabled ?? userIds.length > 0,
    });
}

export function usePermissions(options?: { enabled?: boolean }) {
    const contextKey = getAccessCatalogContextKey();
    return useQuery({
        queryKey: ["permissions", ...contextKey],
        queryFn: getPermissions,
        enabled: options?.enabled ?? true,
    });
}

export function useRoles(options?: { enabled?: boolean }) {
    const contextKey = getAccessCatalogContextKey();
    return useQuery({
        queryKey: ["roles", ...contextKey],
        queryFn: getRoleTemplates,
        enabled: options?.enabled ?? true,
    });
}

export function useRoleTemplates(options?: { enabled?: boolean }) {
    const contextKey = getAccessCatalogContextKey();
    return useQuery({
        queryKey: ["role-templates", ...contextKey],
        queryFn: getRoleTemplates,
        enabled: options?.enabled ?? true,
    });
}

export function useUserRoles(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery<RoleDefinition[]>({
        queryKey: ["user-roles", userId ?? "me"],
        queryFn: () => getUserRoles(userId ?? undefined),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useCreateRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: { key: string; name: string; description?: string }) => createRole(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-templates"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useDeleteRole() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roleId }: { roleId: string }) => deleteRole(roleId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-templates"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useUpdateRoleTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            roleId,
            name,
            description,
        }: {
            roleId: string;
            name?: string;
            description?: string | null;
        }) => updateRoleTemplate(roleId, { name, description }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-templates"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useSetRolePermissions() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ roleId, permissionKeys, mode }: { roleId: string; permissionKeys: string[]; mode?: "add" | "replace" }) =>
            setRolePermissions(roleId, permissionKeys, mode ?? "add"),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["roles"] });
            queryClient.invalidateQueries({ queryKey: ["role-templates"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useSetUserRoles() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, roleIds, mode }: { userId: string; roleIds: string[]; mode?: "replace" | "add" }) =>
            setUserRoles(userId, { roleIds, mode }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["user-roles", variables.userId] });
            queryClient.invalidateQueries({ queryKey: ["effective-permissions", [variables.userId]] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useUserAccessAssignments(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["user-access-assignments", userId],
        queryFn: () => getUserAccessAssignments(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useCreateUserAccessAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            userId,
            payload,
        }: {
            userId: string;
            payload: { roleTemplateId: string; scopeType: "ORG" | "BUILDING"; scopeId?: string | null };
        }) => createUserAccessAssignment(userId, payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["user-access-assignments", variables.userId] });
            queryClient.invalidateQueries({ queryKey: ["effective-permissions", [variables.userId]] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useDeleteUserAccessAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, assignmentId }: { userId: string; assignmentId: string }) =>
            deleteUserAccessAssignment(userId, assignmentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["user-access-assignments", variables.userId] });
            queryClient.invalidateQueries({ queryKey: ["effective-permissions", [variables.userId]] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ role, data }: { role: any; data: any }) => createUser(role, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useProvisionUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: provisionUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}

export function useDeleteUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ role, id, buildingIds }: { role: any; id: string; buildingIds?: string[] }) => deleteUser(role, id, buildingIds),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["request-assignees"] });
        },
    });
}
