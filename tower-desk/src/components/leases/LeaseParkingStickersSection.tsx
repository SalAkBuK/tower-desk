"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Tag, Plus, Trash2, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    useLeaseParkingStickers,
    useCreateLeaseParkingStickers,
    useUpdateLeaseParkingStickerStatus,
    useDeleteLeaseParkingSticker,
} from "@/lib/queries";
import type { LeaseParkingSticker, AccessItemStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface LeaseParkingStickersSectionProps {
    leaseId: string;
    readOnly?: boolean;
}

const STATUS_LABELS: Record<AccessItemStatus, string> = {
    ISSUED: "Issued",
    RETURNED: "Returned",
    DEACTIVATED: "Deactivated",
};

const STATUS_COLORS: Record<AccessItemStatus, string> = {
    ISSUED: "bg-green-100 text-green-800",
    RETURNED: "bg-blue-100 text-blue-800",
    DEACTIVATED: "bg-zinc-100 text-zinc-600",
};

// Valid status transitions per Phase 2 rules
function getValidNextStatuses(currentStatus: AccessItemStatus): AccessItemStatus[] {
    switch (currentStatus) {
        case "ISSUED":
            return ["RETURNED", "DEACTIVATED"];
        case "RETURNED":
            return ["DEACTIVATED"];
        case "DEACTIVATED":
            return []; // No further transitions
        default:
            return [];
    }
}

export function LeaseParkingStickersSection({
    leaseId,
    readOnly = false,
}: LeaseParkingStickersSectionProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [stickerNumbersInput, setStickerNumbersInput] = useState("");
    const [deletingSticker, setDeletingSticker] = useState<LeaseParkingSticker | null>(null);

    const { data: stickers, isLoading } = useLeaseParkingStickers(leaseId);
    const createMutation = useCreateLeaseParkingStickers();
    const updateStatusMutation = useUpdateLeaseParkingStickerStatus();
    const deleteMutation = useDeleteLeaseParkingSticker();

    const handleAdd = async () => {
        // Parse multiline input into array
        const stickerNumbers = stickerNumbersInput
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean);

        if (stickerNumbers.length === 0) {
            toast.error("Please enter at least one sticker number");
            return;
        }

        try {
            await createMutation.mutateAsync({ leaseId, stickerNumbers });
            toast.success(`${stickerNumbers.length} parking sticker(s) added`);
            setStickerNumbersInput("");
            setShowAddForm(false);
        } catch (error: any) {
            if (error.message?.includes("409") || error.message?.toLowerCase().includes("conflict")) {
                toast.error("Conflict: Some sticker numbers may already exist");
            } else if (error.message?.includes("400")) {
                toast.error("Invalid request");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else {
                toast.error(error.message || "Failed to add parking stickers");
            }
        }
    };

    const handleStatusChange = async (sticker: LeaseParkingSticker, newStatus: AccessItemStatus) => {
        try {
            await updateStatusMutation.mutateAsync({
                leaseId,
                stickerId: sticker.id,
                status: newStatus,
            });
            toast.success(`Sticker status updated to ${STATUS_LABELS[newStatus]}`);
        } catch (error: any) {
            if (error.message?.includes("409") || error.message?.toLowerCase().includes("conflict")) {
                toast.error("Conflict: Invalid status transition");
            } else {
                toast.error(error.message || "Failed to update status");
            }
        }
    };

    const handleDelete = async () => {
        if (!deletingSticker) return;
        try {
            await deleteMutation.mutateAsync({ leaseId, stickerId: deletingSticker.id });
            toast.success("Parking sticker deleted");
            setDeletingSticker(null);
        } catch (error: any) {
            if (error.message?.includes("404")) {
                toast.error("Sticker not found");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else {
                toast.error(error.message || "Failed to delete sticker");
            }
        }
    };

    const isPending = createMutation.isPending || updateStatusMutation.isPending;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-900">Parking Stickers</h3>
                {!readOnly && !showAddForm && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Stickers
                    </Button>
                )}
            </div>

            {showAddForm && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="stickerNumbers">Sticker Numbers (one per line)</Label>
                        <Textarea
                            id="stickerNumbers"
                            placeholder={"STK-001\nSTK-002\nSTK-003"}
                            value={stickerNumbersInput}
                            onChange={(e) => setStickerNumbersInput(e.target.value)}
                            rows={4}
                            className="font-mono text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAddForm(false);
                                setStickerNumbersInput("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAdd}
                            disabled={isPending || !stickerNumbersInput.trim()}
                        >
                            {createMutation.isPending ? "Adding..." : "Add Stickers"}
                        </Button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-3">
                            <Skeleton className="h-5 w-24" />
                        </div>
                    ))}
                </div>
            ) : (stickers || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500">
                    No parking stickers issued.
                </div>
            ) : (
                <div className="space-y-2">
                    {(stickers || []).map((sticker) => {
                        const validNextStatuses = getValidNextStatuses(sticker.status);
                        const canChangeStatus = !readOnly && validNextStatuses.length > 0;

                        return (
                            <div
                                key={sticker.id}
                                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                        <Tag className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-900 font-mono">
                                            {sticker.stickerNumber}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {canChangeStatus ? (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 gap-1 px-2"
                                                    disabled={updateStatusMutation.isPending}
                                                >
                                                    <Badge
                                                        variant="secondary"
                                                        className={STATUS_COLORS[sticker.status]}
                                                    >
                                                        {STATUS_LABELS[sticker.status]}
                                                    </Badge>
                                                    <ChevronDown className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {validNextStatuses.map((status) => (
                                                    <DropdownMenuItem
                                                        key={status}
                                                        onClick={() => handleStatusChange(sticker, status)}
                                                    >
                                                        Mark as {STATUS_LABELS[status]}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <Badge
                                            variant="secondary"
                                            className={STATUS_COLORS[sticker.status]}
                                        >
                                            {STATUS_LABELS[sticker.status]}
                                        </Badge>
                                    )}

                                    {!readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-zinc-500 hover:text-red-600"
                                            onClick={() => setDeletingSticker(sticker)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deletingSticker)}
                onOpenChange={(open) => !open && setDeletingSticker(null)}
                title="Delete Parking Sticker?"
                description={`This will remove sticker "${deletingSticker?.stickerNumber || ""}" from this lease.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />
        </div>
    );
}
