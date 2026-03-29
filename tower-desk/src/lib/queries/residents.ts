import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createBuildingResident,
    createResidentWithProfile,
    getBuildingOccupancies,
    getBuildingOccupanciesDto,
    getBuildingResidents,
    getOrgResidents,
    getResidentDirectory,
    getUserById,
    listResidentInvites,
    moveResidentOccupancy,
    resendResidentInvite,
    resetUserPassword,
    updateMyProfile,
    updateUserProfile,
    upsertResidentProfile,
} from "../api/residents";
import type { ResidentInviteFilterStatus } from "../types";
import { IS_PROD } from "./shared";

export function useBuildingOccupanciesDto(
    buildingId: string,
    status: "ACTIVE" | "ENDED" | "ALL" = "ACTIVE",
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ["building-occupancies-dto", buildingId, status],
        queryFn: () => getBuildingOccupanciesDto(buildingId, status),
        enabled: options?.enabled ?? !!buildingId,
    });
}

export function useBuildingResidents(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["building-residents", buildingId],
        queryFn: () => getBuildingResidents(buildingId),
        enabled: options?.enabled ?? !!buildingId,
    });
}

export function useBuildingOccupancies(buildingId: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["building-occupancies", buildingId],
        queryFn: () => getBuildingOccupancies(buildingId),
        enabled: options?.enabled ?? !!buildingId,
    });
}

export function useCreateBuildingResident() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, data }: { buildingId: string; data: { name: string; email: string; password?: string; unitId: string } }) =>
            createBuildingResident(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-residents", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-units", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-occupancies", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        },
    });
}

export function useCreateResidentWithProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ data }: { data: { user: { name: string; email: string; phone?: string; password?: string }; profile?: { emiratesIdNumber?: string; passportNumber?: string; nationality?: string; dateOfBirth?: string; currentAddress?: string; emergencyContactName?: string; emergencyContactPhone?: string } } }) =>
            createResidentWithProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["resident-directory"] });
            queryClient.invalidateQueries({ queryKey: ["building-residents"] });
            queryClient.invalidateQueries({ queryKey: ["org-residents"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        },
    });
}

export function useResendResidentInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) => resendResidentInvite(userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-residents"] });
            queryClient.invalidateQueries({ queryKey: ["resident-invites"] });
        },
    });
}

export function useUserById(userId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["user", userId],
        queryFn: () => getUserById(userId as string),
        enabled: options?.enabled ?? Boolean(userId),
    });
}

export function useResidentInvites(
    params?: { status?: ResidentInviteFilterStatus; q?: string; limit?: number; cursor?: string },
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ["resident-invites", params],
        queryFn: () => listResidentInvites(params),
        enabled: options?.enabled ?? true,
    });
}

export function useOrgResidents(
    params?: { status?: "ALL" | "WITH_OCCUPANCY" | "WITHOUT_OCCUPANCY" | "NEW" | "FORMER"; q?: string; limit?: number; cursor?: string; includeProfile?: boolean },
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: ["org-residents", params],
        queryFn: () => getOrgResidents(params),
        enabled: options?.enabled ?? true,
    });
}

export function useUpdateUserProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { name?: string; email?: string; phoneNumber?: string; avatarUrl?: string; isActive?: boolean } }) =>
            updateUserProfile(userId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
            queryClient.invalidateQueries({ queryKey: ["building-residents"] });
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
        },
    });
}

export function useUpsertResidentProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, data }: { userId: string; data: { emiratesIdNumber?: string; passportNumber?: string; nationality?: string; dateOfBirth?: string; currentAddress?: string; emergencyContactName?: string; emergencyContactPhone?: string } }) =>
            upsertResidentProfile(userId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["resident-directory"] });
            queryClient.invalidateQueries({ queryKey: ["user", variables.userId] });
        },
    });
}

export function useResetUserPassword() {
    return useMutation({
        mutationFn: (userId: string) => resetUserPassword(userId),
    });
}

export function useMoveResidentOccupancy() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { buildingId: string; residentUserId: string; residentEmail: string; residentName: string; unitId?: string; mode: "MOVE" | "MOVE_OUT" }) =>
            moveResidentOccupancy(data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["building-residents", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-units", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-occupancies", variables.buildingId] });
        },
    });
}

export function useResidentDirectory(
    buildingId: string,
    params?: {
        q?: string;
        status?: string;
        sort?: "residentName" | "unitLabel" | "createdAt" | "startAt";
        order?: "asc" | "desc";
        limit?: number;
        cursor?: string | null;
        includeProfile?: boolean;
        enabled?: boolean;
    }
) {
    return useQuery({
        queryKey: [
            "resident-directory",
            buildingId,
            params?.q ?? "",
            params?.status ?? "",
            params?.sort ?? "",
            params?.order ?? "",
            params?.limit ?? "",
            params?.cursor ?? "",
            params?.includeProfile ?? false,
        ],
        queryFn: () =>
            getResidentDirectory(buildingId, {
                q: params?.q,
                status: params?.status,
                sort: params?.sort,
                order: params?.order,
                limit: params?.limit,
                cursor: params?.cursor ?? undefined,
                includeProfile: params?.includeProfile,
            }),
        enabled: params?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useUpdateMyProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name?: string; avatarUrl?: string; phone?: string }) => updateMyProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["users"] });
        },
    });
}
