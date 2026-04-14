import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    cleanupDeliveryTasks,
    createPlatformOrg,
    createPlatformOrgAdmin,
    getDeliveryTask,
    getDeliveryTaskSummary,
    getOrgProfile,
    listDeliveryTasks,
    getPlatformOrgAdmins,
    getPlatformOrgs,
    retryDeliveryTask,
    retryFailedDeliveryTasks,
    updateOrgProfile,
} from "../api/platform";
import type {
    CleanupDeliveryTasksBody,
    DeliveryTask,
    DeliveryTaskListResponse,
    DeliveryTaskSummaryResponse,
    ListDeliveryTasksQuery,
    RetryFailedDeliveryTasksBody,
} from "../deliveryTasks";

export function useCreatePlatformOrg() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: {
            name: string;
            businessName?: string;
            businessType?: "OWNER" | "PROPERTY_MANAGEMENT" | "FACILITY_MANAGEMENT" | "DEVELOPER";
            tradeLicenseNumber?: string;
            vatRegistrationNumber?: string;
            registeredOfficeAddress?: string;
            city?: string;
            officePhoneNumber?: string;
            businessEmailAddress?: string;
            website?: string;
            ownerName?: string;
        }) => createPlatformOrg(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["platform-orgs"] });
        },
    });
}

export const getDeliveryTasksQueryKey = (query: ListDeliveryTasksQuery = {}) =>
    ["platform-delivery-tasks", query] as const;

export const getDeliveryTaskSummaryQueryKey = (
    query: Omit<ListDeliveryTasksQuery, "cursor" | "limit"> = {},
) => ["platform-delivery-task-summary", query] as const;

export function useCreatePlatformOrgAdmin() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ orgId, name, email, password }: { orgId: string; name: string; email: string; password?: string }) =>
            createPlatformOrgAdmin(orgId, { name, email, password }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["platform-org-admins"] });
        },
    });
}

export function usePlatformOrgs() {
    return useQuery({
        queryKey: ["platform-orgs"],
        queryFn: getPlatformOrgs,
    });
}

export function usePlatformOrgAdmins() {
    return useQuery({
        queryKey: ["platform-org-admins"],
        queryFn: getPlatformOrgAdmins,
    });
}

export function useDeliveryTasks(query: ListDeliveryTasksQuery, options?: { enabled?: boolean }) {
    return useQuery<DeliveryTaskListResponse>({
        queryKey: getDeliveryTasksQueryKey(query),
        queryFn: () => listDeliveryTasks(query),
        enabled: options?.enabled ?? true,
    });
}

export function useDeliveryTaskSummary(
    query: Omit<ListDeliveryTasksQuery, "cursor" | "limit">,
    options?: { enabled?: boolean },
) {
    return useQuery<DeliveryTaskSummaryResponse>({
        queryKey: getDeliveryTaskSummaryQueryKey(query),
        queryFn: () => getDeliveryTaskSummary(query),
        enabled: options?.enabled ?? true,
    });
}

export function useDeliveryTask(taskId: string, options?: { enabled?: boolean }) {
    return useQuery<DeliveryTask>({
        queryKey: ["platform-delivery-task", taskId],
        queryFn: () => getDeliveryTask(taskId),
        enabled: options?.enabled ?? Boolean(taskId),
    });
}

export function useRetryDeliveryTask() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (taskId: string) => retryDeliveryTask(taskId),
        onSuccess: (_, taskId) => {
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-task-summary"] });
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-task", taskId] });
        },
    });
}

export function useRetryFailedDeliveryTasks() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: RetryFailedDeliveryTasksBody) => retryFailedDeliveryTasks(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-task-summary"] });
        },
    });
}

export function useCleanupDeliveryTasks() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: CleanupDeliveryTasksBody) => cleanupDeliveryTasks(body),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-tasks"] });
            queryClient.invalidateQueries({ queryKey: ["platform-delivery-task-summary"] });
        },
    });
}

export function useOrgProfile(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["org-profile"],
        queryFn: getOrgProfile,
        enabled: options?.enabled ?? true,
    });
}

export function useUpdateOrgProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            name?: string;
            logoUrl?: string;
            businessName?: string;
            businessType?: "OWNER" | "PROPERTY_MANAGEMENT" | "FACILITY_MANAGEMENT" | "DEVELOPER";
            tradeLicenseNumber?: string;
            vatRegistrationNumber?: string;
            registeredOfficeAddress?: string;
            city?: string;
            officePhoneNumber?: string;
            businessEmailAddress?: string;
            website?: string;
            ownerName?: string;
        }) => updateOrgProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["org-profile"] });
        },
    });
}
