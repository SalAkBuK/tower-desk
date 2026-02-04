"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Users, Pencil, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeaseOccupants, useReplaceLeaseOccupants } from "@/lib/queries";

interface LeaseOccupantsSectionProps {
    leaseId: string;
    readOnly?: boolean;
}

/**
 * Pre-submit cleanup as per Phase 2 rules:
 * - Split by newline
 * - Trim each name
 * - Filter out empty strings
 * - Deduplicate case-insensitively (keep first occurrence)
 */
function cleanupOccupantNames(input: string): string[] {
    return input
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean)
        .filter(
            (v, i, a) =>
                a.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i
        );
}

export function LeaseOccupantsSection({
    leaseId,
    readOnly = false,
}: LeaseOccupantsSectionProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [namesInput, setNamesInput] = useState("");

    const { data: occupants, isLoading } = useLeaseOccupants(leaseId);
    const replaceMutation = useReplaceLeaseOccupants();

    // Convert current occupants to textarea format when starting edit
    const startEditing = () => {
        const currentNames = (occupants || []).map((o) => o.name).join("\n");
        setNamesInput(currentNames);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setNamesInput("");
    };

    const handleSave = async () => {
        // Apply pre-submit cleanup as required by Phase 2
        const names = cleanupOccupantNames(namesInput);

        try {
            await replaceMutation.mutateAsync({ leaseId, names });
            toast.success(
                names.length === 0
                    ? "All occupants removed"
                    : `${names.length} occupant(s) saved`
            );
            setIsEditing(false);
            setNamesInput("");
        } catch (error: any) {
            if (error.message?.includes("409") || error.message?.toLowerCase().includes("conflict")) {
                toast.error("Conflict: Could not update occupants");
            } else if (error.message?.includes("400")) {
                toast.error("Invalid request");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else if (error.message?.includes("404")) {
                toast.error("Lease not found");
            } else {
                toast.error(error.message || "Failed to save occupants");
            }
        }
    };

    // Preview of cleaned names for user feedback
    const cleanedNames = useMemo(() => {
        if (!isEditing) return [];
        return cleanupOccupantNames(namesInput);
    }, [namesInput, isEditing]);

    const hasChanges = useMemo(() => {
        if (!isEditing) return false;
        const currentNames = (occupants || []).map((o) => o.name.toLowerCase()).sort();
        const newNames = cleanedNames.map((n) => n.toLowerCase()).sort();
        if (currentNames.length !== newNames.length) return true;
        return currentNames.some((name, i) => name !== newNames[i]);
    }, [occupants, cleanedNames, isEditing]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-900">Occupants</h3>
                {!readOnly && !isEditing && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={startEditing}
                    >
                        <Pencil className="mr-1 h-4 w-4" />
                        Edit
                    </Button>
                )}
            </div>

            {isEditing ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="occupantNames">
                            Occupant Names (one per line)
                        </Label>
                        <Textarea
                            id="occupantNames"
                            placeholder={"John Doe\nJane Doe\nChild Name"}
                            value={namesInput}
                            onChange={(e) => setNamesInput(e.target.value)}
                            rows={6}
                            className="text-sm"
                        />
                        {cleanedNames.length > 0 && (
                            <p className="text-xs text-zinc-500">
                                {cleanedNames.length} unique name(s) will be saved
                                {cleanedNames.length !== namesInput.split("\n").filter(Boolean).length && (
                                    <span className="text-amber-600"> (duplicates removed)</span>
                                )}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={cancelEditing}
                        >
                            <X className="mr-1 h-4 w-4" />
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSave}
                            disabled={replaceMutation.isPending || !hasChanges}
                        >
                            <Save className="mr-1 h-4 w-4" />
                            {replaceMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            ) : isLoading ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-3">
                            <Skeleton className="h-5 w-32" />
                        </div>
                    ))}
                </div>
            ) : (occupants || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500">
                    No occupants listed.
                </div>
            ) : (
                <div className="space-y-2">
                    {(occupants || []).map((occupant) => (
                        <div
                            key={occupant.id}
                            className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                <Users className="h-4 w-4" />
                            </div>
                            <div className="text-sm font-medium text-zinc-900">
                                {occupant.name}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
