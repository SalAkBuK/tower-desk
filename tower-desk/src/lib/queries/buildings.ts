import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseRole } from "../types";
import {
    assignAdminToBuilding,
    createBuilding,
    deleteBuilding,
    deleteBuildingAssignment,
    getBuilding,
    getBuildings,
    getBuildingsForAdmin,
    getBuildingsForManager,
    updateBuilding,
} from "../api/buildings";
import type { UpdateBuildingPayload } from "../types";

export function useBuildings(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["buildings"],
        queryFn: getBuildings,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminBuildings(adminId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["admin-buildings", adminId],
        queryFn: () => getBuildingsForAdmin(adminId as string),
        enabled: options?.enabled ?? !!adminId,
    });
}

export function useManagerBuildings(managerId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["manager-buildings", managerId],
        queryFn: () => getBuildingsForManager(managerId as string),
        enabled: options?.enabled ?? !!managerId,
    });
}

export function useAccessibleBuildings(userId?: string, baseRole?: BaseRole, options?: { enabled?: boolean }) {
    const isManager = baseRole === "manager";
    const enabled = options?.enabled ?? true;
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : userId, { enabled: enabled && !isManager });
    const managerBuildingsQuery = useManagerBuildings(isManager ? userId : undefined, { enabled: enabled && isManager });

    return isManager ? managerBuildingsQuery : adminBuildingsQuery;
}

export function useBuilding(id: string) {
    return useQuery({
        queryKey: ["buildings", id],
        queryFn: () => getBuilding(id),
        enabled: !!id,
    });
}

export function useCreateBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createBuilding,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["buildings"] });
        },
    });
}

export function useUpdateBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: UpdateBuildingPayload }) =>
            updateBuilding(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["buildings"] });
            queryClient.invalidateQueries({ queryKey: ["admin-buildings"] });
            queryClient.invalidateQueries({ queryKey: ["manager-buildings"] });
            queryClient.invalidateQueries({ queryKey: ["buildings", variables.buildingId] });
        },
    });
}

export function useDeleteBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: deleteBuilding,
        onSuccess: (_, buildingId) => {
            queryClient.invalidateQueries({ queryKey: ["buildings"] });
            queryClient.invalidateQueries({ queryKey: ["admin-buildings"] });
            queryClient.invalidateQueries({ queryKey: ["manager-buildings"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["requests"] });
            queryClient.removeQueries({ queryKey: ["buildings", buildingId] });
            queryClient.removeQueries({ queryKey: ["building-units", buildingId] });
            queryClient.removeQueries({ queryKey: ["building-amenities", buildingId] });
        },
    });
}

export function useAssignAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, adminId }: { buildingId: string; adminId: string }) =>
            assignAdminToBuilding(buildingId, adminId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["buildings"] });
            queryClient.invalidateQueries({ queryKey: ["buildings", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["admin-buildings", variables.adminId] });
        },
    });
}

export function useDeleteBuildingAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, assignmentId }: { buildingId: string; assignmentId: string }) =>
            deleteBuildingAssignment(buildingId, assignmentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
            queryClient.invalidateQueries({ queryKey: ["users"] });
            queryClient.invalidateQueries({ queryKey: ["buildings", variables.buildingId] });
        },
    });
}
