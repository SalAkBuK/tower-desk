"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useMoveOut } from "@/lib/queries";

interface MoveOutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    leaseId: string;
    unitId?: string;
    unitLabel?: string;
    residentName?: string;
    onCompleted?: () => void;
}

const ConditionStatusEnum = z.enum(["OK", "REPAIR_NEEDED"]);
const YesNoEnum = z.enum(["YES", "NO"]);
const ApprovalStatusEnum = z.enum(["APPROVED", "PENDING", "REJECTED"]);
const RefundMethodEnum = z.enum(["BANK_TRANSFER", "CHEQUE", "CASH"]);

const optionalString = (value?: string) => (value && value.trim().length > 0 ? value.trim() : undefined);

const accessCardsReturnedCountSchema: z.ZodType<number | undefined> = z.preprocess(
    (value) => {
        if (value === "" || value === null || value === undefined) return undefined;
        const parsed = Number(value);
        return Number.isNaN(parsed) ? value : parsed;
    },
    z.number().min(0, "Must be 0 or greater").optional()
);

const moveOutSchema = z.object({
    actualMoveOutDate: z.string().min(1, "Move-out date is required"),
    forwardingPhone: z.string().optional(),
    forwardingEmail: z.string().optional(),
    forwardingAddress: z.string().optional(),
    finalElectricityReading: z.string().optional(),
    finalWaterReading: z.string().optional(),
    finalGasReading: z.string().optional(),
    wallsCondition: ConditionStatusEnum.optional(),
    floorCondition: ConditionStatusEnum.optional(),
    kitchenCondition: ConditionStatusEnum.optional(),
    bathroomCondition: ConditionStatusEnum.optional(),
    doorsLocksCondition: ConditionStatusEnum.optional(),
    keysReturned: YesNoEnum.optional(),
    accessCardsReturnedCount: accessCardsReturnedCountSchema,
    parkingStickersReturned: YesNoEnum.optional(),
    damageDescription: z.string().optional(),
    damageCharges: z.string().optional(),
    pendingRent: z.string().optional(),
    pendingUtilities: z.string().optional(),
    pendingServiceFines: z.string().optional(),
    totalDeductions: z.string().optional(),
    netRefund: z.string().optional(),
    inspectionDoneBy: z.string().optional(),
    inspectionDate: z.string().optional(),
    managerApproval: ApprovalStatusEnum.optional(),
    refundMethod: RefundMethodEnum.optional(),
    refundDate: z.string().optional(),
    adminNotes: z.string().optional(),
    markAllAccessCardsReturned: z.boolean().optional(),
    markAllParkingStickersReturned: z.boolean().optional(),
});

type MoveOutFormData = z.infer<typeof moveOutSchema>;

export function MoveOutDialog({
    open,
    onOpenChange,
    buildingId,
    leaseId,
    unitId,
    unitLabel,
    residentName,
    onCompleted,
}: MoveOutDialogProps) {
    const moveOut = useMoveOut();

    const form = useForm<MoveOutFormData>({
        resolver: zodResolver(moveOutSchema) as Resolver<MoveOutFormData>,
        defaultValues: {
            actualMoveOutDate: new Date().toISOString().split("T")[0],
            forwardingPhone: "",
            forwardingEmail: "",
            forwardingAddress: "",
            finalElectricityReading: "",
            finalWaterReading: "",
            finalGasReading: "",
            wallsCondition: undefined,
            floorCondition: undefined,
            kitchenCondition: undefined,
            bathroomCondition: undefined,
            doorsLocksCondition: undefined,
            keysReturned: undefined,
            accessCardsReturnedCount: undefined,
            parkingStickersReturned: undefined,
            damageDescription: "",
            damageCharges: "",
            pendingRent: "",
            pendingUtilities: "",
            pendingServiceFines: "",
            totalDeductions: "",
            netRefund: "",
            inspectionDoneBy: "",
            inspectionDate: "",
            managerApproval: undefined,
            refundMethod: undefined,
            refundDate: "",
            adminNotes: "",
            markAllAccessCardsReturned: true,
            markAllParkingStickersReturned: true,
        },
    });

    const onSubmit = async (data: MoveOutFormData) => {
        try {
            await moveOut.mutateAsync({
                buildingId,
                leaseId,
                unitId,
                dto: {
                    actualMoveOutDate: data.actualMoveOutDate,
                    forwardingPhone: optionalString(data.forwardingPhone),
                    forwardingEmail: optionalString(data.forwardingEmail),
                    forwardingAddress: optionalString(data.forwardingAddress),
                    finalElectricityReading: optionalString(data.finalElectricityReading),
                    finalWaterReading: optionalString(data.finalWaterReading),
                    finalGasReading: optionalString(data.finalGasReading),
                    wallsCondition: data.wallsCondition,
                    floorCondition: data.floorCondition,
                    kitchenCondition: data.kitchenCondition,
                    bathroomCondition: data.bathroomCondition,
                    doorsLocksCondition: data.doorsLocksCondition,
                    keysReturned: data.keysReturned,
                    accessCardsReturnedCount: data.accessCardsReturnedCount,
                    parkingStickersReturned: data.parkingStickersReturned,
                    damageDescription: optionalString(data.damageDescription),
                    damageCharges: optionalString(data.damageCharges),
                    pendingRent: optionalString(data.pendingRent),
                    pendingUtilities: optionalString(data.pendingUtilities),
                    pendingServiceFines: optionalString(data.pendingServiceFines),
                    totalDeductions: optionalString(data.totalDeductions),
                    netRefund: optionalString(data.netRefund),
                    inspectionDoneBy: optionalString(data.inspectionDoneBy),
                    inspectionDate: optionalString(data.inspectionDate),
                    managerApproval: data.managerApproval,
                    refundMethod: data.refundMethod,
                    refundDate: optionalString(data.refundDate),
                    adminNotes: optionalString(data.adminNotes),
                    markAllAccessCardsReturned: data.markAllAccessCardsReturned ?? true,
                    markAllParkingStickersReturned: data.markAllParkingStickersReturned ?? true,
                },
            });
            toast.success("Move-out completed successfully");
            form.reset();
            onCompleted?.();
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to complete move-out";
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Move Out - Unit {unitLabel || unitId}</DialogTitle>
                    <DialogDescription>
                        End the lease for {residentName || "this resident"}. This will mark access cards and parking stickers as returned.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="actualMoveOutDate">Move-Out Date *</Label>
                        <Input
                            id="actualMoveOutDate"
                            type="date"
                            {...form.register("actualMoveOutDate")}
                        />
                        {form.formState.errors.actualMoveOutDate && (
                            <p className="text-xs text-rose-500">{form.formState.errors.actualMoveOutDate.message}</p>
                        )}
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Forwarding</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="forwardingPhone">Forwarding Phone</Label>
                                <Input id="forwardingPhone" {...form.register("forwardingPhone")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="forwardingEmail">Forwarding Email</Label>
                                <Input id="forwardingEmail" type="email" {...form.register("forwardingEmail")} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="forwardingAddress">Forwarding Address</Label>
                                <Input id="forwardingAddress" {...form.register("forwardingAddress")} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Final Meter Readings</div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="finalElectricityReading">Electricity</Label>
                                <Input id="finalElectricityReading" {...form.register("finalElectricityReading")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="finalWaterReading">Water</Label>
                                <Input id="finalWaterReading" {...form.register("finalWaterReading")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="finalGasReading">Gas</Label>
                                <Input id="finalGasReading" {...form.register("finalGasReading")} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Unit Condition</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[
                                { key: "wallsCondition", label: "Walls" },
                                { key: "floorCondition", label: "Floor" },
                                { key: "kitchenCondition", label: "Kitchen" },
                                { key: "bathroomCondition", label: "Bathroom" },
                                { key: "doorsLocksCondition", label: "Doors/Locks" },
                            ].map((field) => (
                                <div key={field.key} className="space-y-2">
                                    <Label>{field.label}</Label>
                                    <Select
                                        value={form.watch(field.key as keyof MoveOutFormData) as string | undefined}
                                        onValueChange={(value) => form.setValue(field.key as keyof MoveOutFormData, value as any)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="OK">OK</SelectItem>
                                            <SelectItem value="REPAIR_NEEDED">Repair needed</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Returns</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Keys Returned</Label>
                                <Select
                                    value={form.watch("keysReturned")}
                                    onValueChange={(value) => form.setValue("keysReturned", value as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="YES">Yes</SelectItem>
                                        <SelectItem value="NO">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="accessCardsReturnedCount">Access Cards Returned</Label>
                                <Input
                                    id="accessCardsReturnedCount"
                                    type="number"
                                    min={0}
                                    {...form.register("accessCardsReturnedCount")}
                                />
                                {form.formState.errors.accessCardsReturnedCount && (
                                    <p className="text-xs text-rose-500">
                                        {form.formState.errors.accessCardsReturnedCount.message}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Parking Stickers Returned</Label>
                                <Select
                                    value={form.watch("parkingStickersReturned")}
                                    onValueChange={(value) => form.setValue("parkingStickersReturned", value as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="YES">Yes</SelectItem>
                                        <SelectItem value="NO">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="markAllAccessCardsReturned"
                                checked={form.watch("markAllAccessCardsReturned")}
                                onCheckedChange={(checked) => form.setValue("markAllAccessCardsReturned", Boolean(checked))}
                            />
                            <div>
                                <Label htmlFor="markAllAccessCardsReturned">Mark all access cards as returned</Label>
                                <p className="text-xs text-zinc-500">All issued access cards will be updated to returned.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <Checkbox
                                id="markAllParkingStickersReturned"
                                checked={form.watch("markAllParkingStickersReturned")}
                                onCheckedChange={(checked) => form.setValue("markAllParkingStickersReturned", Boolean(checked))}
                            />
                            <div>
                                <Label htmlFor="markAllParkingStickersReturned">Mark all parking stickers as returned</Label>
                                <p className="text-xs text-zinc-500">All issued parking stickers will be updated to returned.</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Damage & Charges</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="damageDescription">Damage Description</Label>
                                <Textarea id="damageDescription" rows={3} {...form.register("damageDescription")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="damageCharges">Damage Charges</Label>
                                <Input id="damageCharges" {...form.register("damageCharges")} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pending & Refund</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="pendingRent">Pending Rent</Label>
                                <Input id="pendingRent" {...form.register("pendingRent")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pendingUtilities">Pending Utilities</Label>
                                <Input id="pendingUtilities" {...form.register("pendingUtilities")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pendingServiceFines">Pending Service Fines</Label>
                                <Input id="pendingServiceFines" {...form.register("pendingServiceFines")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="totalDeductions">Total Deductions</Label>
                                <Input id="totalDeductions" {...form.register("totalDeductions")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="netRefund">Net Refund</Label>
                                <Input id="netRefund" {...form.register("netRefund")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Refund Method</Label>
                                <Select
                                    value={form.watch("refundMethod")}
                                    onValueChange={(value) => form.setValue("refundMethod", value as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                                        <SelectItem value="CHEQUE">Cheque</SelectItem>
                                        <SelectItem value="CASH">Cash</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="refundDate">Refund Date</Label>
                                <Input id="refundDate" type="date" {...form.register("refundDate")} />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Inspection & Approval</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="inspectionDoneBy">Inspection Done By</Label>
                                <Input id="inspectionDoneBy" {...form.register("inspectionDoneBy")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="inspectionDate">Inspection Date</Label>
                                <Input id="inspectionDate" type="date" {...form.register("inspectionDate")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Manager Approval</Label>
                                <Select
                                    value={form.watch("managerApproval")}
                                    onValueChange={(value) => form.setValue("managerApproval", value as any)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="APPROVED">Approved</SelectItem>
                                        <SelectItem value="PENDING">Pending</SelectItem>
                                        <SelectItem value="REJECTED">Rejected</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="adminNotes">Notes</Label>
                        <Textarea
                            id="adminNotes"
                            placeholder="Optional notes about the move-out..."
                            rows={3}
                            {...form.register("adminNotes")}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="destructive" disabled={moveOut.isPending}>
                            {moveOut.isPending ? "Processing..." : "Complete Move Out"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
