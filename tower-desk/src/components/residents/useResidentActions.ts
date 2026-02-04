import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { getActiveLeaseForUnit } from "@/lib/api";
import type { OrgResidentListItem, ResidentDirectoryRow } from "@/lib/types";

type MoveOutContext = {
    resident: OrgResidentListItem;
    leaseId: string;
    unitId: string;
    unitLabel?: string;
    buildingId: string;
};

type TransferContext = {
    resident: OrgResidentListItem;
    leaseId?: string;
    unitId?: string;
    unitLabel?: string;
    buildingId: string;
};

type ActiveOccupancyContext = {
    buildingId?: string;
    unitId?: string;
    unitLabel?: string;
} | null;

interface UseResidentActionsOptions {
    selectedBuildingId: string;
    residentDirectoryByUserId: Map<string, ResidentDirectoryRow>;
    getActiveOccupancyContext: (
        resident: OrgResidentListItem,
        directoryRow?: ResidentDirectoryRow | null,
        fallbackBuildingId?: string,
    ) => ActiveOccupancyContext;
}

export function useResidentActions({
    selectedBuildingId,
    residentDirectoryByUserId,
    getActiveOccupancyContext,
}: UseResidentActionsOptions) {
    const queryClient = useQueryClient();

    const [isMoveInOpen, setIsMoveInOpen] = useState(false);
    const [moveInResident, setMoveInResident] = useState<OrgResidentListItem | null>(null);
    const [transferContext, setTransferContext] = useState<TransferContext | null>(null);
    const [moveOutContext, setMoveOutContext] = useState<MoveOutContext | null>(null);
    const [moveOutLoadingId, setMoveOutLoadingId] = useState<string | null>(null);
    const [editResident, setEditResident] = useState<OrgResidentListItem | null>(null);

    const openMoveInDialog = (resident?: OrgResidentListItem | null) => {
        if (!selectedBuildingId) {
            toast.error("Select a building before moving in a resident.");
            return;
        }
        setIsMoveInOpen(!resident);
        setMoveInResident(resident ?? null);
    };

    const closeMoveIn = (open: boolean) => {
        if (!open) {
            setIsMoveInOpen(false);
            setMoveInResident(null);
        }
    };

    const openMoveOutDialog = async (resident: OrgResidentListItem) => {
        const directoryRow = residentDirectoryByUserId.get(resident.user.id);
        const context = getActiveOccupancyContext(resident, directoryRow, selectedBuildingId);
        const buildingId = context?.buildingId ?? selectedBuildingId;
        const unitId = context?.unitId;
        if (!buildingId || !unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.user.id);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", buildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(buildingId, unitId),
            });
            if (!lease) {
                toast.error("No active lease found for this unit");
                return;
            }
            setMoveOutContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to load lease";
            toast.error(message);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const closeMoveOut = (open: boolean) => {
        if (!open) {
            setMoveOutContext(null);
        }
    };

    const openTransferDialog = async (resident: OrgResidentListItem) => {
        const directoryRow = residentDirectoryByUserId.get(resident.user.id);
        const context = getActiveOccupancyContext(resident, directoryRow, selectedBuildingId);
        const buildingId = context?.buildingId ?? selectedBuildingId;
        const unitId = context?.unitId;
        if (!buildingId || !unitId) {
            toast.error("Resident has no unit assigned");
            return;
        }
        setMoveOutLoadingId(resident.user.id);
        try {
            const lease = await queryClient.fetchQuery({
                queryKey: ["leases", "active", buildingId, unitId],
                queryFn: () => getActiveLeaseForUnit(buildingId, unitId),
            });
            if (!lease) {
                toast.message("No active lease found — opening transfer without move-out.");
                setTransferContext({
                    resident,
                    unitId,
                    unitLabel: context?.unitLabel,
                    buildingId,
                });
                setMoveInResident(resident);
                return;
            }
            setTransferContext({
                resident,
                leaseId: lease.id,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
            setMoveInResident(resident);
        } catch (error) {
            toast.message("No active lease found — opening transfer without move-out.");
            setTransferContext({
                resident,
                unitId,
                unitLabel: context?.unitLabel,
                buildingId,
            });
            setMoveInResident(resident);
        } finally {
            setMoveOutLoadingId(null);
        }
    };

    const closeTransfer = () => {
        setMoveInResident(null);
        setTransferContext(null);
    };

    return {
        isMoveInOpen,
        moveInResident,
        openMoveInDialog,
        closeMoveIn,

        moveOutContext,
        moveOutLoadingId,
        openMoveOutDialog,
        closeMoveOut,

        transferContext,
        openTransferDialog,
        closeTransfer,

        editResident,
        setEditResident,
    };
}
