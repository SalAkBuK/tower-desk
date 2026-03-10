"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, ChevronDown } from "lucide-react";

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
    useLeaseAccessCards,
    useCreateLeaseAccessCards,
    useUpdateLeaseAccessCardStatus,
    useDeleteLeaseAccessCard,
} from "@/lib/queries";
import type { LeaseAccessCard, AccessItemStatus } from "@/lib/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface LeaseAccessCardsSectionProps {
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

export function LeaseAccessCardsSection({
    leaseId,
    readOnly = false,
}: LeaseAccessCardsSectionProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [cardNumbersInput, setCardNumbersInput] = useState("");
    const [deletingCard, setDeletingCard] = useState<LeaseAccessCard | null>(null);

    const { data: cards, isLoading } = useLeaseAccessCards(leaseId);
    const createMutation = useCreateLeaseAccessCards();
    const updateStatusMutation = useUpdateLeaseAccessCardStatus();
    const deleteMutation = useDeleteLeaseAccessCard();

    const handleAdd = async () => {
        // Parse multiline input into array
        const cardNumbers = cardNumbersInput
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean);

        if (cardNumbers.length === 0) {
            toast.error("Please enter at least one card number");
            return;
        }

        try {
            await createMutation.mutateAsync({ leaseId, cardNumbers });
            toast.success(`${cardNumbers.length} access card(s) added`);
            setCardNumbersInput("");
            setShowAddForm(false);
        } catch (error: any) {
            if (error.message?.includes("409") || error.message?.toLowerCase().includes("conflict")) {
                toast.error("Conflict: Some card numbers may already exist");
            } else if (error.message?.includes("400")) {
                toast.error("Invalid request");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else {
                toast.error(error.message || "Failed to add access cards");
            }
        }
    };

    const handleStatusChange = async (card: LeaseAccessCard, newStatus: AccessItemStatus) => {
        try {
            await updateStatusMutation.mutateAsync({
                leaseId,
                cardId: card.id,
                status: newStatus,
            });
            toast.success(`Card status updated to ${STATUS_LABELS[newStatus]}`);
        } catch (error: any) {
            if (error.message?.includes("409") || error.message?.toLowerCase().includes("conflict")) {
                toast.error("Conflict: Invalid status transition");
            } else {
                toast.error(error.message || "Failed to update status");
            }
        }
    };

    const handleDelete = async () => {
        if (!deletingCard) return;
        try {
            await deleteMutation.mutateAsync({ leaseId, cardId: deletingCard.id });
            toast.success("Access card deleted");
            setDeletingCard(null);
        } catch (error: any) {
            if (error.message?.includes("404")) {
                toast.error("Card not found");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else {
                toast.error(error.message || "Failed to delete card");
            }
        }
    };

    const isPending = createMutation.isPending || updateStatusMutation.isPending;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-900">Access Cards</h3>
                {!readOnly && !showAddForm && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddForm(true)}
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        Add Cards
                    </Button>
                )}
            </div>

            {showAddForm && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="cardNumbers">Card Numbers (one per line)</Label>
                        <Textarea
                            id="cardNumbers"
                            placeholder={"CARD-001\nCARD-002\nCARD-003"}
                            value={cardNumbersInput}
                            onChange={(e) => setCardNumbersInput(e.target.value)}
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
                                setCardNumbersInput("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleAdd}
                            disabled={isPending || !cardNumbersInput.trim()}
                        >
                            {createMutation.isPending ? "Adding..." : "Add Cards"}
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
            ) : (cards || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500">
                    No access cards issued.
                </div>
            ) : (
                <div className="space-y-2">
                    {(cards || []).map((card) => {
                        const validNextStatuses = getValidNextStatuses(card.status);
                        const canChangeStatus = !readOnly && validNextStatuses.length > 0;

                        return (
                            <div
                                key={card.id}
                                className="flex items-center justify-between rounded-lg border border-zinc-200 p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                        <CreditCard className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-zinc-900 font-mono">
                                            {card.cardNumber}
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
                                                        className={STATUS_COLORS[card.status]}
                                                    >
                                                        {STATUS_LABELS[card.status]}
                                                    </Badge>
                                                    <ChevronDown className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                {validNextStatuses.map((status) => (
                                                    <DropdownMenuItem
                                                        key={status}
                                                        onClick={() => handleStatusChange(card, status)}
                                                    >
                                                        Mark as {STATUS_LABELS[status]}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    ) : (
                                        <Badge
                                            variant="secondary"
                                            className={STATUS_COLORS[card.status]}
                                        >
                                            {STATUS_LABELS[card.status]}
                                        </Badge>
                                    )}

                                    {!readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-zinc-500 hover:text-red-600"
                                            onClick={() => setDeletingCard(card)}
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
                open={Boolean(deletingCard)}
                onOpenChange={(open) => !open && setDeletingCard(null)}
                title="Delete Access Card?"
                description={`This will remove card "${deletingCard?.cardNumber || ""}" from this contract.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />
        </div>
    );
}
