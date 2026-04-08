import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createProviderStaff,
    createServiceProviderAccessGrant,
    createServiceProvider,
    disableServiceProviderAccessGrant,
    getProviderProfile,
    getProviderRuntimeContext,
    getProviderStaff,
    getServiceProvider,
    getServiceProviderAccessGrants,
    getServiceProviders,
    linkServiceProviderBuilding,
    resendServiceProviderAccessGrantInvite,
    unlinkServiceProviderBuilding,
    updateProviderProfile,
    updateProviderStaff,
    updateServiceProvider,
} from "../api/providers";
import type {
    CreateProviderStaffPayload,
    CreateServiceProviderPayload,
    LinkServiceProviderBuildingPayload,
    ProviderProfile,
    UpdateProviderStaffPayload,
    UpdateServiceProviderPayload,
} from "../types";

export function useServiceProviders(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["service-providers"],
        queryFn: () => getServiceProviders(),
        enabled: options?.enabled ?? true,
    });
}

export function useServiceProvider(providerId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["service-provider", providerId],
        queryFn: () => getServiceProvider(providerId as string),
        enabled: options?.enabled ?? Boolean(providerId),
    });
}

export function useServiceProviderAccessGrants(providerId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["service-provider-access-grants", providerId ?? ""],
        queryFn: () => getServiceProviderAccessGrants(providerId as string),
        enabled: options?.enabled ?? Boolean(providerId),
    });
}

export function useProviderRuntimeContext(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-runtime-context"],
        queryFn: getProviderRuntimeContext,
        enabled: options?.enabled ?? true,
    });
}

export function useProviderProfile(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-profile"],
        queryFn: getProviderProfile,
        enabled: options?.enabled ?? true,
    });
}

export function useProviderStaff(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["provider-staff"],
        queryFn: getProviderStaff,
        enabled: options?.enabled ?? true,
    });
}

const invalidateServiceProviderQueries = (queryClient: ReturnType<typeof useQueryClient>, providerId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["service-providers"] });
    if (providerId) {
        queryClient.invalidateQueries({ queryKey: ["service-provider", providerId] });
        queryClient.invalidateQueries({ queryKey: ["service-provider-access-grants", providerId] });
    }
    queryClient.invalidateQueries({ queryKey: ["service-provider-access-grants"] });
    queryClient.invalidateQueries({ queryKey: ["request"] });
    queryClient.invalidateQueries({ queryKey: ["requests"] });
    queryClient.invalidateQueries({ queryKey: ["admin-requests"] });
};

const invalidateProviderPortalQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
    queryClient.invalidateQueries({ queryKey: ["provider-profile"] });
    queryClient.invalidateQueries({ queryKey: ["provider-staff"] });
    queryClient.invalidateQueries({ queryKey: ["provider-runtime-context"] });
    queryClient.invalidateQueries({ queryKey: ["provider-requests"] });
};

export function useCreateServiceProvider() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateServiceProviderPayload) => createServiceProvider(payload),
        onSuccess: (provider) => invalidateServiceProviderQueries(queryClient, provider.id),
    });
}

export function useUpdateServiceProvider() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ providerId, payload }: { providerId: string; payload: UpdateServiceProviderPayload }) =>
            updateServiceProvider(providerId, payload),
        onSuccess: (provider) => invalidateServiceProviderQueries(queryClient, provider.id),
    });
}

export function useLinkServiceProviderBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            providerId,
            payload,
        }: {
            providerId: string;
            payload: LinkServiceProviderBuildingPayload;
        }) => linkServiceProviderBuilding(providerId, payload),
        onSuccess: (provider) => invalidateServiceProviderQueries(queryClient, provider.id),
    });
}

export function useUnlinkServiceProviderBuilding() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ providerId, buildingId }: { providerId: string; buildingId: string }) =>
            unlinkServiceProviderBuilding(providerId, buildingId),
        onSuccess: (provider) => invalidateServiceProviderQueries(queryClient, provider.id),
    });
}

export function useCreateServiceProviderAccessGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ providerId, email }: { providerId: string; email: string }) =>
            createServiceProviderAccessGrant(providerId, email),
        onSuccess: (_, variables) => invalidateServiceProviderQueries(queryClient, variables.providerId),
    });
}

export function useResendServiceProviderAccessGrantInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ providerId, grantId }: { providerId: string; grantId: string }) =>
            resendServiceProviderAccessGrantInvite(providerId, grantId),
        onSuccess: (_, variables) => invalidateServiceProviderQueries(queryClient, variables.providerId),
    });
}

export function useDisableServiceProviderAccessGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ providerId, grantId, verificationMethod }: { providerId: string; grantId: string; verificationMethod?: string }) =>
            disableServiceProviderAccessGrant(providerId, grantId, verificationMethod),
        onSuccess: (_, variables) => invalidateServiceProviderQueries(queryClient, variables.providerId),
    });
}

export function useUpdateProviderProfile() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: Partial<ProviderProfile>) => updateProviderProfile(payload),
        onSuccess: () => invalidateProviderPortalQueries(queryClient),
    });
}

export function useCreateProviderStaff() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateProviderStaffPayload) => createProviderStaff(payload),
        onSuccess: () => invalidateProviderPortalQueries(queryClient),
    });
}

export function useUpdateProviderStaff() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, payload }: { userId: string; payload: UpdateProviderStaffPayload }) =>
            updateProviderStaff(userId, payload),
        onSuccess: () => invalidateProviderPortalQueries(queryClient),
    });
}
