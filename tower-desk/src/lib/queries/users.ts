import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createRole,
    createUser,
    deleteUser,
    getEffectivePermissions,
    getPermissions,
    getRoles,
    getUserPermissionOverrides,
    getUserRoles,
    getUsers,
    getUsersForAdminBuildings,
    setRolePermissions,
    setUserPermissionOverrides,
    setUserRoles,
} from "../api/users";
import type { RoleDefinition } from "../types";

export function useUsers(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["users"],
        queryFn: getUsers,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminUsers(buildingIds: string[]) {
    return useQuery({
        queryKey: ["admin-users", buildingIds],
        queryFn: () => getUsersForAdminBuildings(buildingIds),
        enabled: buildingIds.length > 0,
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
    return useQuery({
        queryKey: ["permissions"],
        queryFn: getPermissions,
        enabled: options?.enabled ?? true,
    });
}

export function useRoles(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["roles"],
        queryFn: getRoles,
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
        },
    });
}
