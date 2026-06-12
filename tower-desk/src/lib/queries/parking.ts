import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createParkingAllocations,
    createParkingSlot,
    createVehicle,
    deleteVehicle,
    endAllParkingAllocations,
    endAllUnitParkingAllocations,
    endParkingAllocation,
    getOccupancyParkingAllocations,
    getOccupancyVehicles,
    getParkingSlots,
    getUnitParkingAllocations,
    updateParkingSlot,
    updateVehicle,
} from "../api/parking";
import type { ParkingSlotType } from "../types";
import { IS_PROD } from "./shared";

export function useParkingSlots(
    buildingId: string,
    options?: { available?: boolean; active?: boolean; status?: string; type?: string; search?: string; enabled?: boolean }
) {
    const queryKey = ["parking-slots", buildingId, options?.available ?? false] as Array<string | boolean>;
    if (
        options?.active !== undefined ||
        options?.status ||
        options?.type ||
        options?.search
    ) {
        queryKey.push(
            options?.active ?? "",
            options?.status ?? "",
            options?.type ?? "",
            options?.search ?? ""
        );
    }
    return useQuery({
        queryKey,
        queryFn: () => getParkingSlots(buildingId, {
            available: options?.available,
            active: options?.active,
            status: options?.status,
            type: options?.type,
            q: options?.search,
        }),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateParkingSlot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { code: string; type: ParkingSlotType; level?: string; isCovered?: boolean } }) =>
            createParkingSlot(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
        },
    });
}

export function useUpdateParkingSlot() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ slotId, data }: { slotId: string; buildingId: string; data: { code?: string; type?: ParkingSlotType; level?: string; isCovered?: boolean; isActive?: boolean } }) =>
            updateParkingSlot(slotId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
        },
    });
}

export function useOccupancyParkingAllocations(occupancyId: string, options?: { active?: boolean; enabled?: boolean }) {
    return useQuery({
        queryKey: ["occupancy-parking-allocations", occupancyId, options?.active],
        queryFn: () => getOccupancyParkingAllocations(occupancyId, { active: options?.active }),
        enabled: options?.enabled ?? !!occupancyId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { buildingId: string; leaseId?: string; data: { occupancyId?: string; unitId?: string; slotIds?: string[]; count?: number } }) =>
            createParkingAllocations(variables.buildingId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["parking-slot-unit-labels", variables.buildingId] });
            if (variables.data.occupancyId) {
                queryClient.invalidateQueries({ queryKey: ["occupancy-parking-allocations", variables.data.occupancyId] });
            }
            if (variables.data.unitId) {
                queryClient.invalidateQueries({ queryKey: ["unit-parking-allocations", variables.data.unitId] });
            }
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}

export function useUnitParkingAllocations(unitId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["unit-parking-allocations", unitId],
        queryFn: () => getUnitParkingAllocations(unitId),
        enabled: options?.enabled ?? !!unitId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useEndAllUnitParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ unitId, data }: { unitId: string; buildingId?: string; data?: { endDate?: string } }) =>
            endAllUnitParkingAllocations(unitId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["unit-parking-allocations", variables.unitId] });
            if (variables.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
            }
        },
    });
}

export function useEndParkingAllocation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { allocationId: string; buildingId: string; occupancyId: string; leaseId?: string; data?: { endDate?: string } }) =>
            endParkingAllocation(variables.allocationId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["occupancy-parking-allocations", variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}

export function useEndAllParkingAllocations() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { occupancyId: string; buildingId: string; leaseId?: string; data?: { endDate?: string } }) =>
            endAllParkingAllocations(variables.occupancyId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["parking-slots", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["occupancy-parking-allocations", variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}

export function useOccupancyVehicles(occupancyId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["occupancy-vehicles", occupancyId],
        queryFn: () => getOccupancyVehicles(occupancyId),
        enabled: options?.enabled ?? !!occupancyId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { occupancyId: string; leaseId?: string; data: { plateNumber: string; label?: string } }) =>
            createVehicle(variables.occupancyId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["occupancy-vehicles", variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}

export function useUpdateVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { vehicleId: string; occupancyId: string; leaseId?: string; data: { plateNumber?: string; label?: string } }) =>
            updateVehicle(variables.vehicleId, variables.data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["occupancy-vehicles", variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}

export function useDeleteVehicle() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { vehicleId: string; occupancyId: string; leaseId?: string }) =>
            deleteVehicle(variables.vehicleId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["occupancy-vehicles", variables.occupancyId] });
            if (variables.leaseId) {
                queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
                queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            }
        },
    });
}
