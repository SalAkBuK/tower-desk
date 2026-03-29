import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createVisitor, getVisitors, updateVisitor } from "../api/visitors";
import type { VisitorStatus, VisitorType } from "../types";
import { IS_PROD } from "./shared";

export function useVisitors(buildingId: string, filters?: { status?: VisitorStatus; unitId?: string }, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["visitors", buildingId, filters?.status ?? "", filters?.unitId ?? ""],
        queryFn: () => getVisitors(buildingId, filters),
        enabled: options?.enabled ?? !!buildingId,
        refetchOnWindowFocus: !IS_PROD,
        staleTime: IS_PROD ? 60_000 : 0,
    });
}

export function useCreateVisitor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            data,
        }: {
            buildingId: string;
            data: {
                unitId: string;
                visitorName: string;
                phoneNumber?: string;
                type: VisitorType;
                emiratesId?: string;
                vehicleNumber?: string;
                expectedArrivalAt?: string;
                notes?: string;
            };
        }) => createVisitor(buildingId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["visitors", variables.buildingId] });
        },
    });
}

export function useUpdateVisitor() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            buildingId,
            visitorId,
            data,
        }: {
            buildingId: string;
            visitorId: string;
            data: {
                status?: VisitorStatus;
                type?: VisitorType;
                visitorName?: string;
                phoneNumber?: string;
                unitId?: string;
                emiratesId?: string;
                vehicleNumber?: string;
                expectedArrivalAt?: string | null;
                notes?: string;
            };
        }) => updateVisitor(buildingId, visitorId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["visitors", variables.buildingId] });
        },
    });
}
