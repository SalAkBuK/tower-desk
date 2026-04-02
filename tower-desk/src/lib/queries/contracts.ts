import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    activateContract,
    approveMoveInRequest,
    approveMoveOutRequest,
    cancelContract,
    createContract,
    createLeaseAccessCards,
    createLeaseDocument,
    createLeaseParkingStickers,
    createMoveInRequest,
    createMoveOutRequest,
    deleteLeaseAccessCard,
    deleteLeaseDocument,
    deleteLeaseParkingSticker,
    executeMoveIn,
    executeMoveOut,
    getActiveLeaseForUnit,
    getLatestContractForResident,
    getLeaseById,
    getLeaseHistory,
    getLeaseOccupants,
    getLeaseTimeline,
    getOrgLeases,
    getResidentLeases,
    getResidentLeaseTimeline,
    listLeaseAccessCards,
    listLeaseDocuments,
    listLeaseParkingStickers,
    listMoveInRequests,
    listMoveOutRequests,
    rejectMoveInRequest,
    rejectMoveOutRequest,
    replaceContractTerms,
    replaceLeaseOccupants,
    updateLease,
    updateLeaseAccessCardStatus,
    updateLeaseParkingStickerStatus,
} from "../api/contracts";
import type {
    AccessItemStatus,
    ContractMoveRequestStatusFilter,
    CreateContractDto,
    CreateContractMoveRequestDto,
    LeaseDocumentType,
    LeaseTimelineQuery,
    OrgLeasesQuery,
    RejectContractMoveRequestDto,
    ResidentLeaseListQuery,
    ResidentLeaseTimelineQuery,
    UpdateLeaseDto,
} from "../types";

export function useLeaseAccessCards(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "accessCards", leaseId],
        queryFn: () => listLeaseAccessCards(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateLeaseAccessCards() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardNumbers }: { leaseId: string; cardNumbers: string[] }) =>
            createLeaseAccessCards(leaseId, { cardNumbers }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "accessCards", variables.leaseId] });
        },
    });
}

export function useUpdateLeaseAccessCardStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardId, status }: { leaseId: string; cardId: string; status: AccessItemStatus }) =>
            updateLeaseAccessCardStatus(leaseId, cardId, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "accessCards", variables.leaseId] });
        },
    });
}

export function useDeleteLeaseAccessCard() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, cardId }: { leaseId: string; cardId: string }) =>
            deleteLeaseAccessCard(leaseId, cardId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "accessCards", variables.leaseId] });
        },
    });
}

export function useLeaseParkingStickers(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "parkingStickers", leaseId],
        queryFn: () => listLeaseParkingStickers(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateLeaseParkingStickers() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerNumbers }: { leaseId: string; stickerNumbers: string[] }) =>
            createLeaseParkingStickers(leaseId, { stickerNumbers }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "parkingStickers", variables.leaseId] });
        },
    });
}

export function useUpdateLeaseParkingStickerStatus() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerId, status }: { leaseId: string; stickerId: string; status: AccessItemStatus }) =>
            updateLeaseParkingStickerStatus(leaseId, stickerId, { status }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "parkingStickers", variables.leaseId] });
        },
    });
}

export function useDeleteLeaseParkingSticker() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, stickerId }: { leaseId: string; stickerId: string }) =>
            deleteLeaseParkingSticker(leaseId, stickerId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "parkingStickers", variables.leaseId] });
        },
    });
}

export function useLeaseOccupants(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "occupants", leaseId],
        queryFn: () => getLeaseOccupants(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useReplaceLeaseOccupants() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, names }: { leaseId: string; names: string[] }) =>
            replaceLeaseOccupants(leaseId, { names }),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "occupants", variables.leaseId] });
        },
    });
}

export function useOrgLeases(query?: OrgLeasesQuery, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["org-leases", query],
        queryFn: () => getOrgLeases(query),
        enabled: options?.enabled ?? true,
        retry: (failureCount, error) => {
            const status = (error as { status?: unknown })?.status;
            if (typeof status === "number" && [400, 401, 403, 404].includes(status)) return false;
            return failureCount < 2;
        },
    });
}

export function useActiveLease(buildingId?: string, unitId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "active", buildingId, unitId],
        queryFn: () => getActiveLeaseForUnit(buildingId as string, unitId as string),
        enabled: options?.enabled ?? Boolean(buildingId && unitId),
    });
}

export function useLeaseById(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "byId", leaseId],
        queryFn: () => getLeaseById(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ buildingId, dto }: { buildingId: string; dto: CreateContractDto }) =>
            createContract(buildingId, dto),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", contract.id] });
            queryClient.invalidateQueries({ queryKey: ["resident-directory", variables.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-units", variables.buildingId] });
        },
    });
}

export function useActivateContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => activateContract(contractId),
        onSuccess: (contract) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", contract.id] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", contract.id] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", contract.residentUserId] });
            }
        },
    });
}

export function useCancelContract() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, reason }: { contractId: string; reason?: string }) => cancelContract(contractId, reason),
        onSuccess: (contract) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", contract.id] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            queryClient.invalidateQueries({ queryKey: ["lease-history", contract.id] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", contract.id] });
            queryClient.invalidateQueries({ queryKey: ["move-in-requests"] });
            queryClient.invalidateQueries({ queryKey: ["move-out-requests"] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", contract.residentUserId] });
            }
        },
    });
}

export function useReplaceContractTerms() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, terms }: { contractId: string; terms: string[] }) => replaceContractTerms(contractId, terms),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", contract.residentUserId] });
            }
        },
    });
}

export function useLatestContractForResident(residentUserId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["resident-contract-latest", residentUserId],
        queryFn: () => getLatestContractForResident(residentUserId as string),
        enabled: options?.enabled ?? Boolean(residentUserId),
    });
}

export function useUpdateLease() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, dto }: { leaseId: string; dto: UpdateLeaseDto }) => updateLease(leaseId, dto),
        onSuccess: (updatedLease, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ["lease-history", variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            if (updatedLease.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-leases", updatedLease.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-lease-timeline", updatedLease.residentUserId] });
            }
            queryClient.invalidateQueries({ queryKey: ["leases", "active", updatedLease.buildingId, updatedLease.unitId] });
            queryClient.invalidateQueries({ queryKey: ["building-occupancies", updatedLease.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-occupancies-dto", updatedLease.buildingId] });
            queryClient.invalidateQueries({ queryKey: ["building-units", updatedLease.buildingId] });
        },
    });
}

export function useLeaseHistory(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["lease-history", leaseId],
        queryFn: () => getLeaseHistory(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useResidentLeases(residentUserId?: string, query?: ResidentLeaseListQuery, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["resident-leases", residentUserId, query],
        queryFn: () => getResidentLeases(residentUserId as string, query),
        enabled: options?.enabled ?? !!residentUserId,
    });
}

export function useResidentLeaseTimeline(residentUserId?: string, query?: ResidentLeaseTimelineQuery, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["resident-lease-timeline", residentUserId, query],
        queryFn: () => getResidentLeaseTimeline(residentUserId as string, query),
        enabled: options?.enabled ?? !!residentUserId,
    });
}

export function useLeaseTimeline(leaseId?: string, query?: LeaseTimelineQuery, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["lease-timeline", leaseId, query],
        queryFn: () => getLeaseTimeline(leaseId as string, query),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useLeaseDocuments(leaseId?: string, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["leases", "documents", leaseId],
        queryFn: () => listLeaseDocuments(leaseId as string),
        enabled: options?.enabled ?? !!leaseId,
    });
}

export function useCreateMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, dto }: { contractId: string; dto: CreateContractMoveRequestDto }) => createMoveInRequest(contractId, dto),
        onSuccess: (request, variables) => {
            queryClient.invalidateQueries({ queryKey: ["move-in-requests"] });
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-in-requests", request.buildingId] });
            }
            if (request.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", request.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", request.residentUserId] });
            }
        },
    });
}

export function useCreateMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId, dto }: { contractId: string; dto: CreateContractMoveRequestDto }) => createMoveOutRequest(contractId, dto),
        onSuccess: (request, variables) => {
            queryClient.invalidateQueries({ queryKey: ["move-out-requests"] });
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-out-requests", request.buildingId] });
            }
            if (request.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", request.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", request.residentUserId] });
            }
        },
    });
}

export function useMoveInRequests(buildingId?: string, status?: ContractMoveRequestStatusFilter, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["move-in-requests", buildingId, status ?? "ALL"],
        queryFn: () => listMoveInRequests(buildingId as string, status),
        enabled: options?.enabled ?? Boolean(buildingId),
    });
}

export function useMoveOutRequests(buildingId?: string, status?: ContractMoveRequestStatusFilter, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ["move-out-requests", buildingId, status ?? "ALL"],
        queryFn: () => listMoveOutRequests(buildingId as string, status),
        enabled: options?.enabled ?? Boolean(buildingId),
    });
}

export function usePendingContractMoveRequestsCount(
    buildingIds: string[],
    options?: { enabled?: boolean }
) {
    const normalizedBuildingIds = [...new Set(buildingIds.map((id) => String(id)).filter(Boolean))].sort();
    return useQuery({
        queryKey: ["contract-move-request-count", normalizedBuildingIds],
        queryFn: async () => {
            if (normalizedBuildingIds.length === 0) return 0;
            const [moveInResponses, moveOutResponses] = await Promise.all(
                normalizedBuildingIds.map(async (buildingId) => ({
                    moveIn: await listMoveInRequests(buildingId, "PENDING"),
                    moveOut: await listMoveOutRequests(buildingId, "PENDING"),
                }))
            );
            return moveInResponses.reduce(
                (count, entry) => count + entry.moveIn.length + entry.moveOut.length,
                0
            );
        },
        enabled: options?.enabled ?? normalizedBuildingIds.length > 0,
    });
}

export function useApproveMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) => approveMoveInRequest(requestId),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ["move-in-requests"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-in-requests", request.buildingId] });
            }
        },
    });
}

export function useRejectMoveInRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, dto }: { requestId: string; dto?: RejectContractMoveRequestDto }) => rejectMoveInRequest(requestId, dto),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ["move-in-requests"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-in-requests", request.buildingId] });
            }
        },
    });
}

export function useApproveMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId }: { requestId: string }) => approveMoveOutRequest(requestId),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ["move-out-requests"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-out-requests", request.buildingId] });
            }
        },
    });
}

export function useRejectMoveOutRequest() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ requestId, dto }: { requestId: string; dto?: RejectContractMoveRequestDto }) => rejectMoveOutRequest(requestId, dto),
        onSuccess: (request) => {
            queryClient.invalidateQueries({ queryKey: ["move-out-requests"] });
            if (request.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["move-out-requests", request.buildingId] });
            }
        },
    });
}

export function useExecuteMoveIn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => executeMoveIn(contractId),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["lease-history", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            queryClient.invalidateQueries({ queryKey: ["move-in-requests"] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", contract.residentUserId] });
            }
            if (contract.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["building-occupancies", contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ["building-occupancies-dto", contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ["resident-directory", contract.buildingId] });
            }
        },
    });
}

export function useExecuteMoveOut() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ contractId }: { contractId: string }) => executeMoveOut(contractId),
        onSuccess: (contract, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["lease-history", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["lease-timeline", variables.contractId] });
            queryClient.invalidateQueries({ queryKey: ["org-leases"] });
            queryClient.invalidateQueries({ queryKey: ["move-out-requests"] });
            if (contract.residentUserId) {
                queryClient.invalidateQueries({ queryKey: ["resident-contract-latest", contract.residentUserId] });
                queryClient.invalidateQueries({ queryKey: ["resident-leases", contract.residentUserId] });
            }
            if (contract.buildingId) {
                queryClient.invalidateQueries({ queryKey: ["building-occupancies", contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ["building-occupancies-dto", contract.buildingId] });
                queryClient.invalidateQueries({ queryKey: ["resident-directory", contract.buildingId] });
            }
        },
    });
}

export function useCreateLeaseDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, dto }: { leaseId: string; dto: { type: LeaseDocumentType; fileName: string; mimeType: string; sizeBytes: number; url: string } }) =>
            createLeaseDocument(leaseId, dto),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "documents", variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
        },
    });
}

export function useDeleteLeaseDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ leaseId, documentId }: { leaseId: string; documentId: string }) => deleteLeaseDocument(leaseId, documentId),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["leases", "documents", variables.leaseId] });
            queryClient.invalidateQueries({ queryKey: ["leases", "byId", variables.leaseId] });
        },
    });
}
