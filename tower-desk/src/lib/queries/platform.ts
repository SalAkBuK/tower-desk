import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createPlatformOrg,
    createPlatformOrgAdmin,
    getOrgProfile,
    getPlatformOrgAdmins,
    getPlatformOrgs,
    updateOrgProfile,
} from "../api/platform";

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
