import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createBuildingAssignment, getBuildingAssignments } from "../api/buildings";
import { createOwner, getOwners } from "../api/owners";
import {
    createBuildingAmenity,
    createBuildingUnit,
    createUnitType,
    getBuildingAmenities,
    getBuildingUnit,
    getBuildingUnits,
    getUnitTypes,
    updateBuildingAmenity,
    updateBuildingUnit,
} from "../api/units";
import type { CreateOwnerPayload, FurnishedStatus, KitchenType, MaintenancePayer, PaymentFrequency, UnitSizeUnit } from "../types";
import { IS_PROD } from "./shared";

export function useBuildingUnits(
    buildingId: string,
    options?: { available?: boolean; includeOccupancy?: boolean; search?: string; enabled?: boolean }
) {
    return useQuery({
        queryKey: [
            "building-units",
            buildingId,
            options?.available ?? false,
            options?.includeOccupancy ?? false,
            options?.search ?? "",
        ],
        queryFn: () =>
            getBuildingUnits(buildingId, {
                available: options?.available,
                includeOccupancy: options?.includeOccupancy,
                q: options?.search,
            }),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useBuildingUnit(buildingId: string, unitId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["building-unit", buildingId, unitId],
        queryFn: () => getBuildingUnit(buildingId, unitId),
        enabled: options?.enabled ?? Boolean(buildingId && unitId),
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useUnitTypes(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["unit-types"],
        queryFn: getUnitTypes,
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useBuildingAmenities(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["building-amenities", buildingId],
        queryFn: () => getBuildingAmenities(buildingId),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useCreateBuildingAmenity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { name: string; isDefault?: boolean; isActive?: boolean } }) =>
            createBuildingAmenity(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-amenities", variables.buildingId] });
        },
    });
}

export function useUpdateBuildingAmenity() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            amenityId,
            data,
        }: {
            buildingId: string;
            amenityId: string;
            data: { name?: string; isDefault?: boolean; isActive?: boolean };
        }) => updateBuildingAmenity(buildingId, amenityId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-amenities", variables.buildingId] });
        },
    });
}

export function useCreateUnitType() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; isActive?: boolean }) => createUnitType(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["unit-types"] });
        },
    });
}

export function useOwners(options?: { enabled?: boolean; search?: string }) {
    return useQuery({
        queryKey: ["owners", options?.search ?? ""],
        queryFn: () => getOwners(options?.search),
        enabled: options?.enabled ?? true,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 5 * 60_000 : 0,
    });
}

export function useCreateOwner() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateOwnerPayload) => createOwner(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["owners"] });
        },
    });
}

export function useCreateBuildingUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            data,
        }: {
            buildingId: string;
            data: {
                label: string;
                floor?: number;
                notes?: string;
                unitTypeId?: string;
                ownerId?: string;
                maintenancePayer?: MaintenancePayer;
                unitSize?: number;
                unitSizeUnit?: UnitSizeUnit;
                bedrooms?: number;
                bathrooms?: number;
                balcony?: boolean;
                kitchenType?: KitchenType;
                furnishedStatus?: FurnishedStatus;
                rentAnnual?: number;
                paymentFrequency?: PaymentFrequency;
                securityDepositAmount?: number;
                serviceChargePerUnit?: number;
                vatApplicable?: boolean;
                electricityMeterNumber?: string;
                waterMeterNumber?: string;
                gasMeterNumber?: string;
                amenityIds?: string[];
            };
        }) => createBuildingUnit(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-units", variables.buildingId] });
        },
    });
}

export function useUpdateBuildingUnit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            unitId,
            data,
        }: {
            buildingId: string;
            unitId: string;
            data: {
                label?: string;
                floor?: number;
                notes?: string;
                unitTypeId?: string;
                ownerId?: string;
                maintenancePayer?: MaintenancePayer;
                unitSize?: number;
                unitSizeUnit?: UnitSizeUnit;
                bedrooms?: number;
                bathrooms?: number;
                balcony?: boolean;
                kitchenType?: KitchenType;
                furnishedStatus?: FurnishedStatus;
                rentAnnual?: number;
                paymentFrequency?: PaymentFrequency;
                securityDepositAmount?: number;
                serviceChargePerUnit?: number;
                vatApplicable?: boolean;
                electricityMeterNumber?: string;
                waterMeterNumber?: string;
                gasMeterNumber?: string;
                amenityIds?: string[];
            };
        }) => updateBuildingUnit(buildingId, unitId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-units", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-unit", variables.buildingId, variables.unitId] });
        },
    });
}

export function useBuildingAssignments(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["building-assignments", buildingId],
        queryFn: () => getBuildingAssignments(buildingId),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateBuildingAssignment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { userId: string; type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" } }) =>
            createBuildingAssignment(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-assignments", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        },
    });
}
