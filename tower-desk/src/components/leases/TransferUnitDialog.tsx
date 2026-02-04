"use client";

import { MoveInDialog } from "@/components/leases/MoveInDialog";

interface TransferUnitDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    unitId?: string;
    unitLabel?: string;
    defaultResidentUserId?: string;
    defaultResidentName?: string;
    defaultResidentEmail?: string;
    transferFrom?: {
        leaseId?: string;
        unitId?: string;
        unitLabel?: string;
    };
}

export function TransferUnitDialog(props: TransferUnitDialogProps) {
    return <MoveInDialog {...props} mode="transfer" />;
}
