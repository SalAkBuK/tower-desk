import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BaseRole } from "../types";
import {
    assignAdminToBuilding,
    createBuilding,
    getBuilding,
    getBuildings,
    getBuildingsForAdmin,
    getBuildingsForManager,
} from "../api/buildings";

export function useBuildings(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["buildings"],
        queryFn: getBuildings,
        enabled: options?.enabled ?? true,
    });
}

export function useAdminBuildings(adminId?: string) {
    return useQuery({
        queryKey: ["admin-buildings", adminId],
        queryFn: () => getBuildingsForAdmin(adminId as string),
        enabled: !!adminId,
    });
}

export function useManagerBuildings(managerId?: string) {
    return useQuery({
        queryKey: ["manager-buildings", managerId],
        queryFn: () => getBuildingsForManager(managerId as string),
        enabled: !!managerId,
    });
}

export function useAccessibleBuildings(userId?: string, baseRole?: BaseRole) {
    const isManager = baseRole === "manager";
    const adminBuildingsQuery = useAdminBuildings(isManager ? undefined : userId);
    const managerBuildingsQuery = useManagerBuildings(isManager ? userId : undefined);

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
