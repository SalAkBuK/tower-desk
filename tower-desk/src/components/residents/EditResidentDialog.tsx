"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OccupancyVehicles } from "@/components/residents/OccupancyVehicles";
import {
    useBuildingOccupancies,
    useUpsertResidentProfile,
    useUserById,
} from "@/lib/queries";
import type { OrgResidentListItem } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

const emptyForm = {
    name: "",
    email: "",
    phoneNumber: "",
    avatarUrl: "",
    isActive: true,
};

const emptyProfileForm = {
    emiratesIdNumber: "",
    passportNumber: "",
    nationality: "",
    dateOfBirth: "",
    currentAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
};

interface EditResidentDialogProps {
    resident: OrgResidentListItem | null;
    selectedBuildingId: string;
    onClose: () => void;
}

export function EditResidentDialog({ resident, selectedBuildingId, onClose }: EditResidentDialogProps) {
    const queryClient = useQueryClient();
    const updateResidentProfileMutation = useUpsertResidentProfile();

    const [editValues, setEditValues] = useState(emptyForm);
    const [editProfileValues, setEditProfileValues] = useState(emptyProfileForm);

    const residentUserQuery = useUserById(resident?.user.id, { enabled: Boolean(resident?.user.id) });

    const buildingOccupanciesQuery = useBuildingOccupancies(selectedBuildingId, {
        enabled: Boolean(resident) && Boolean(selectedBuildingId) && Boolean(resident?.hasActiveOccupancy),
    });

    const resolvedOccupancy = useMemo(() => {
        if (!resident || !buildingOccupanciesQuery.data) return null;
        return buildingOccupanciesQuery.data.find((occupancy) => {
            const residentId = occupancy.residentUserId ?? occupancy.resident?.id;
            const residentEmail = occupancy.residentEmail ?? occupancy.resident?.email;
            const status = String(occupancy.status ?? "").toUpperCase();
            const isActive = !occupancy.endAt || status === "ACTIVE";
            return isActive && (
                residentId === resident.user.id
                || (residentEmail && residentEmail === resident.user.email)
            );
        }) ?? null;
    }, [buildingOccupanciesQuery.data, resident]);

    const occupancyIdForVehicles = resident?.occupancyId ?? resolvedOccupancy?.id ?? "";

    const isOccupancyLookupLoading =
        Boolean(resident)
        && resident?.hasActiveOccupancy
        && !resident?.occupancyId
        && buildingOccupanciesQuery.isLoading;

    useEffect(() => {
        if (!resident) {
            setEditValues(emptyForm);
            setEditProfileValues(emptyProfileForm);
            return;
        }
        const profile = residentUserQuery.data;
        const residentProfile = resident.residentProfile;
        setEditValues({
            name: profile?.name ?? resident.user.name ?? "",
            email: profile?.email ?? resident.user.email ?? "",
            phoneNumber: profile?.phoneNumber ?? resident.user.phoneNumber ?? "",
            avatarUrl: profile?.avatarUrl ?? resident.user.avatarUrl ?? "",
            isActive: typeof profile?.isActive === "boolean"
                ? profile.isActive
                : (typeof resident.user.isActive === "boolean" ? resident.user.isActive : true),
        });
        const dateOfBirth = residentProfile?.dateOfBirth
            ? String(residentProfile.dateOfBirth).split("T")[0]
            : "";
        setEditProfileValues({
            emiratesIdNumber: residentProfile?.emiratesIdNumber ?? "",
            passportNumber: residentProfile?.passportNumber ?? "",
            nationality: residentProfile?.nationality ?? "",
            dateOfBirth,
            currentAddress: residentProfile?.currentAddress ?? "",
            emergencyContactName: residentProfile?.emergencyContactName ?? "",
            emergencyContactPhone: residentProfile?.emergencyContactPhone ?? "",
        });
    }, [resident, residentUserQuery.data]);

    const handleSave = async () => {
        if (!resident) return;
        try {
            const dateOfBirth =
                editProfileValues.dateOfBirth && editProfileValues.dateOfBirth.trim()
                    ? new Date(editProfileValues.dateOfBirth).toISOString()
                    : undefined;
            await updateResidentProfileMutation.mutateAsync({
                userId: resident.user.id,
                data: {
                    emiratesIdNumber: editProfileValues.emiratesIdNumber.trim() || undefined,
                    passportNumber: editProfileValues.passportNumber.trim() || undefined,
                    nationality: editProfileValues.nationality.trim() || undefined,
                    dateOfBirth,
                    currentAddress: editProfileValues.currentAddress.trim() || undefined,
                    emergencyContactName: editProfileValues.emergencyContactName.trim() || undefined,
                    emergencyContactPhone: editProfileValues.emergencyContactPhone.trim() || undefined,
                },
            });
            await queryClient.invalidateQueries({ queryKey: ["org-residents"] });
            toast.success("Resident updated");
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update resident";
            toast.error(message);
        }
    };

    return (
        <Dialog open={Boolean(resident)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Resident</DialogTitle>
                    <DialogDescription>Update resident profile and access status.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                            value={editValues.name}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, name: event.target.value }))}
                            disabled
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Email</label>
                        <Input
                            type="email"
                            value={editValues.email}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, email: event.target.value }))}
                            disabled
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Phone</label>
                        <Input
                            value={editValues.phoneNumber}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                            disabled
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Avatar URL</label>
                        <Input
                            value={editValues.avatarUrl}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, avatarUrl: event.target.value }))}
                            placeholder="https://..."
                            disabled
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-500">
                        <input
                            type="checkbox"
                            checked={editValues.isActive}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, isActive: event.target.checked }))}
                            className="rounded border-zinc-300"
                            disabled
                        />
                        Active account
                    </label>

                    <div className="pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Resident Profile</div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Emirates ID</label>
                        <Input
                            value={editProfileValues.emiratesIdNumber}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, emiratesIdNumber: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Passport Number</label>
                        <Input
                            value={editProfileValues.passportNumber}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, passportNumber: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Nationality</label>
                        <Input
                            value={editProfileValues.nationality}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, nationality: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Date of Birth</label>
                        <Input
                            type="date"
                            value={editProfileValues.dateOfBirth}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, dateOfBirth: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Current Address</label>
                        <Input
                            value={editProfileValues.currentAddress}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, currentAddress: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Emergency Contact Name</label>
                        <Input
                            value={editProfileValues.emergencyContactName}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, emergencyContactName: event.target.value }))
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Emergency Contact Phone</label>
                        <Input
                            value={editProfileValues.emergencyContactPhone}
                            onChange={(event) =>
                                setEditProfileValues((prev) => ({ ...prev, emergencyContactPhone: event.target.value }))
                            }
                        />
                    </div>

                    <div className="pt-2">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vehicles</div>
                    </div>
                    <OccupancyVehicles
                        occupancyId={occupancyIdForVehicles}
                        isLoading={Boolean(isOccupancyLookupLoading)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={updateResidentProfileMutation.isPending}
                    >
                        {updateResidentProfileMutation.isPending ? "Saving..." : "Save changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
