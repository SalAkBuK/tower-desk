import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    activateOwnerAccessGrant,
    disableOwnerAccessGrant,
    getOwnerAccessGrantHistory,
    getOwnerAccessGrants,
    inviteOwnerAccessGrant,
    linkExistingOwnerUser,
    resendOwnerAccessGrantInvite,
    resolveOwnerParty,
} from "../api/owners";

export function useResolveOwnerParty() {
    return useMutation({
        mutationFn: resolveOwnerParty,
    });
}

export function useOwnerAccessGrants(ownerId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-access-grants", ownerId],
        queryFn: () => getOwnerAccessGrants(ownerId as string),
        enabled: options?.enabled ?? Boolean(ownerId),
    });
}

export function useOwnerAccessGrantHistory(ownerId?: string | null, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["owner-access-grant-history", ownerId],
        queryFn: () => getOwnerAccessGrantHistory(ownerId as string),
        enabled: options?.enabled ?? Boolean(ownerId),
    });
}

const invalidateOwnerQueries = (queryClient: ReturnType<typeof useQueryClient>, ownerId: string) => {
    queryClient.invalidateQueries({ queryKey: ["owner-access-grants", ownerId] });
    queryClient.invalidateQueries({ queryKey: ["owner-access-grant-history", ownerId] });
    queryClient.invalidateQueries({ queryKey: ["owners"] });
};

export function useInviteOwnerAccessGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ ownerId, email }: { ownerId: string; email: string }) => inviteOwnerAccessGrant(ownerId, { email }),
        onSuccess: (_, variables) => invalidateOwnerQueries(queryClient, variables.ownerId),
    });
}

export function useLinkExistingOwnerUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ ownerId, userId }: { ownerId: string; userId: string }) => linkExistingOwnerUser(ownerId, { userId }),
        onSuccess: (_, variables) => invalidateOwnerQueries(queryClient, variables.ownerId),
    });
}

export function useActivateOwnerAccessGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            ownerId,
            grantId,
            userId,
            verificationMethod,
        }: {
            ownerId: string;
            grantId: string;
            userId: string;
            verificationMethod: string;
        }) => activateOwnerAccessGrant(ownerId, grantId, { userId, verificationMethod }),
        onSuccess: (_, variables) => invalidateOwnerQueries(queryClient, variables.ownerId),
    });
}

export function useDisableOwnerAccessGrant() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            ownerId,
            grantId,
            verificationMethod,
        }: {
            ownerId: string;
            grantId: string;
            verificationMethod: string;
        }) => disableOwnerAccessGrant(ownerId, grantId, { verificationMethod }),
        onSuccess: (_, variables) => invalidateOwnerQueries(queryClient, variables.ownerId),
    });
}

export function useResendOwnerAccessGrantInvite() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ ownerId, grantId }: { ownerId: string; grantId: string }) =>
            resendOwnerAccessGrantInvite(ownerId, grantId),
        onSuccess: (_, variables) => invalidateOwnerQueries(queryClient, variables.ownerId),
    });
}
