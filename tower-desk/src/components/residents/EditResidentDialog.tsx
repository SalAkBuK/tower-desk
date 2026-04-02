"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Mail, Phone, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { OccupancyVehicles } from "@/components/residents/OccupancyVehicles";
import {
    useBuildingOccupancies,
    useUpsertResidentProfile,
    useUserById,
} from "@/lib/queries";
import type { OrgResidentListItem } from "@/lib/types";
import { useQueryClient } from "@tanstack/react-query";

const emptyEditForm = {
    name: "",
    email: "",
    phone: "",
    emiratesIdNumber: "",
    passportNumber: "",
    nationality: "",
    dateOfBirth: "",
    currentAddress: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
};

type EditTenantFormValues = typeof emptyEditForm;

interface EditResidentDialogProps {
    resident: OrgResidentListItem | null;
    selectedBuildingId: string;
    onClose: () => void;
}

export function EditResidentDialog({ resident, selectedBuildingId, onClose }: EditResidentDialogProps) {
    const queryClient = useQueryClient();
    const updateResidentProfileMutation = useUpsertResidentProfile();
    const form = useForm<EditTenantFormValues>({
        defaultValues: emptyEditForm,
    });

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
            form.reset(emptyEditForm);
            return;
        }
        const profile = residentUserQuery.data;
        const residentProfile = resident.residentProfile;
        const dateOfBirth = residentProfile?.dateOfBirth
            ? String(residentProfile.dateOfBirth).split("T")[0]
            : "";

        form.reset({
            name: profile?.name ?? resident.user.name ?? "",
            email: profile?.email ?? resident.user.email ?? "",
            phone: profile?.phoneNumber ?? resident.user.phoneNumber ?? "",
            emiratesIdNumber: residentProfile?.emiratesIdNumber ?? "",
            passportNumber: residentProfile?.passportNumber ?? "",
            nationality: residentProfile?.nationality ?? "",
            dateOfBirth,
            currentAddress: residentProfile?.currentAddress ?? "",
            emergencyContactName: residentProfile?.emergencyContactName ?? "",
            emergencyContactPhone: residentProfile?.emergencyContactPhone ?? "",
        });
    }, [form, resident, residentUserQuery.data]);

    const handleSave = async (data: EditTenantFormValues) => {
        if (!resident) return;
        try {
            const dateOfBirth =
                data.dateOfBirth && data.dateOfBirth.trim()
                    ? new Date(data.dateOfBirth).toISOString()
                    : undefined;
            await updateResidentProfileMutation.mutateAsync({
                userId: resident.user.id,
                data: {
                    emiratesIdNumber: data.emiratesIdNumber.trim() || undefined,
                    passportNumber: data.passportNumber.trim() || undefined,
                    nationality: data.nationality.trim() || undefined,
                    dateOfBirth,
                    currentAddress: data.currentAddress.trim() || undefined,
                    emergencyContactName: data.emergencyContactName.trim() || undefined,
                    emergencyContactPhone: data.emergencyContactPhone.trim() || undefined,
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
                    <DialogDescription>Update resident details and profile information.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input {...field} className="pl-9" disabled />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                <Input type="email" {...field} className="pl-9" disabled />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                <Input {...field} className="pl-9" disabled />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator />

                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Resident Profile
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="emiratesIdNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Emirates ID</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="passportNumber"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Passport Number</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="nationality"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nationality</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dateOfBirth"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date of Birth</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="currentAddress"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Current Address</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="emergencyContactName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Emergency Contact Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="emergencyContactPhone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Emergency Contact Phone</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator />

                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vehicles</div>
                        <OccupancyVehicles
                            occupancyId={occupancyIdForVehicles}
                            isLoading={Boolean(isOccupancyLookupLoading)}
                        />

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={updateResidentProfileMutation.isPending}>
                                {updateResidentProfileMutation.isPending ? "Saving..." : "Save changes"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
