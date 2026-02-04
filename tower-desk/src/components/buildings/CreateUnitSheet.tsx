"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuildingAmenities, useBuildingOccupancies, useBuildingUnit, useCreateBuildingUnit, useCreateOwner, useCreateParkingAllocations, useCreateUnitType, useEndAllUnitParkingAllocations, useOwners, useParkingSlots, useUnitParkingAllocations, useUnitTypes, useUpdateBuildingUnit } from "@/lib/queries";
import type { FurnishedStatus, KitchenType, MaintenancePayer, ParkingSlot, PaymentFrequency, UnitSizeUnit } from "@/lib/types";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueries } from "@tanstack/react-query";
import { Plus, Home, Users, Ruler, CreditCard, Zap, Shield, Star, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getOccupancyParkingAllocations, getOccupancyVehicles } from "@/lib/api";
import { VirtualizedParkingSlotSelect } from "./VirtualizedParkingSlotSelect";

const maintenancePayerOptions = ["OWNER", "TENANT", "BUILDING"] as const;
const unitSizeUnitOptions = ["SQ_FT"] as const;
const kitchenTypeOptions = ["OPEN", "CLOSED"] as const;
const furnishedStatusOptions = ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"] as const;
const paymentFrequencyOptions = ["MONTHLY", "QUARTERLY", "SEMI_ANNUAL"] as const;

function MaybeAnimatePresence({
    isSingleLayout,
    direction,
    children,
}: {
    isSingleLayout: boolean;
    direction: number;
    children: ReactNode;
}) {
    if (isSingleLayout) return <>{children}</>;
    return (
        <AnimatePresence mode="wait" initial={false} custom={direction}>
            {children}
        </AnimatePresence>
    );
}

const normalizeText = (value?: string) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed.length || trimmed.toLowerCase() === "none") {
        return undefined;
    }
    return trimmed;
};

const parseFromOptions = <T extends string>(value: string | undefined, options: readonly T[]): T | undefined => {
    const normalized = normalizeText(value);
    return normalized && options.includes(normalized as T) ? (normalized as T) : undefined;
};

const parseMaintenancePayer = (value?: string): MaintenancePayer | undefined =>
    parseFromOptions<MaintenancePayer>(value, maintenancePayerOptions);

const parseUnitSizeUnit = (value?: string): UnitSizeUnit =>
    parseFromOptions<UnitSizeUnit>(value, unitSizeUnitOptions) ?? "SQ_FT";

const parseKitchenType = (value?: string): KitchenType | undefined =>
    parseFromOptions<KitchenType>(value, kitchenTypeOptions);

const parseFurnishedStatus = (value?: string): FurnishedStatus | undefined =>
    parseFromOptions<FurnishedStatus>(value, furnishedStatusOptions);

const parsePaymentFrequency = (value?: string): PaymentFrequency | undefined =>
    parseFromOptions<PaymentFrequency>(value, paymentFrequencyOptions);

const unitSchema = z.object({
    label: z.string().trim().min(1, "Unit label is required"),
    floor: z.number().int().min(1, "Floor must be at least 1").optional(),
    notes: z.string().trim().optional().or(z.literal("")),
    unitTypeId: z.string().trim().optional().or(z.literal("")).or(z.literal("none")),
    ownerId: z.string().trim().optional().or(z.literal("")).or(z.literal("none")),
    maintenancePayer: z.enum(maintenancePayerOptions).optional().or(z.literal("")),
    unitSize: z.number().min(0, "Unit size must be positive").optional(),
    unitSizeUnit: z.enum(unitSizeUnitOptions),
    bedrooms: z.number().min(0, "Bedrooms must be 0 or more").optional(),
    bathrooms: z.number().min(0, "Bathrooms must be 0 or more").optional(),
    balcony: z.boolean().optional(),
    kitchenType: z.enum(kitchenTypeOptions).optional().or(z.literal("")).or(z.literal("none")),
    furnishedStatus: z.enum(furnishedStatusOptions).optional().or(z.literal("")).or(z.literal("none")),
    rentAnnual: z.number().min(0, "Annual rent must be positive").optional(),
    paymentFrequency: z.enum(paymentFrequencyOptions).optional().or(z.literal("")).or(z.literal("none")),
    securityDepositAmount: z.number().min(0, "Security deposit must be positive").optional(),
    serviceChargePerUnit: z.number().min(0, "Service charge must be positive").optional(),
    vatApplicable: z.boolean().optional(),
    electricityMeterNumber: z.string().trim().optional().or(z.literal("")),
    waterMeterNumber: z.string().trim().optional().or(z.literal("")),
    gasMeterNumber: z.string().trim().optional().or(z.literal("")),
});

type UnitFormValues = z.infer<typeof unitSchema>;

interface CreateUnitSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    mode?: "create" | "edit";
    unitId?: string | null;
    layout?: "wizard" | "single";
}

const steps = [
    {
        key: "basics",
        title: "Basics",
        description: "Label, floor, parking, and notes",
        icon: Home,
        fields: ["label", "floor", "notes"],
    },
    {
        key: "assignments",
        title: "Assignments",
        description: "Connect unit to type and owner",
        icon: Users,
        fields: ["unitTypeId", "ownerId"],
    },
    {
        key: "specifications",
        title: "Specs",
        description: "Size, layout, configuration",
        icon: Ruler,
        fields: ["maintenancePayer", "unitSize", "unitSizeUnit", "kitchenType", "bedrooms", "bathrooms", "furnishedStatus"],
    },
    {
        key: "financials",
        title: "Financials",
        description: "Rent, deposits, charges",
        icon: CreditCard,
        fields: ["paymentFrequency", "rentAnnual", "securityDepositAmount", "serviceChargePerUnit"],
    },
    {
        key: "utilities",
        title: "Utilities",
        description: "Track active meters",
        icon: Zap,
        fields: ["electricityMeterNumber", "waterMeterNumber", "gasMeterNumber"],
    },
    {
        key: "compliance",
        title: "Compliance",
        description: "Additional attributes",
        icon: Shield,
        fields: ["balcony", "vatApplicable"],
    },
    {
        key: "amenities",
        title: "Amenities",
        description: "Assign amenities",
        icon: Star,
        fields: [],
    },
] as const;

export function CreateUnitSheet({
    open,
    onOpenChange,
    buildingId,
    mode = "create",
    unitId,
    layout = "wizard",
}: CreateUnitSheetProps) {
    const isEditMode = mode === "edit" && Boolean(unitId);
    const isSingleLayout = layout === "single";
    const { role, baseRole, user, buildingScope, selectedOrgId, selectedBuildingId } = useAuth();
    const createUnit = useCreateBuildingUnit();
    const updateUnit = useUpdateBuildingUnit();
    const allocateParkingSlots = useCreateParkingAllocations();
    const endAllUnitAllocations = useEndAllUnitParkingAllocations();
    const { data: unitTypes, isLoading: isUnitTypesLoading } = useUnitTypes({ enabled: open });
    const createUnitType = useCreateUnitType();
    const createOwner = useCreateOwner();
    const { data: owners, isLoading: isOwnersLoading } = useOwners({ enabled: open });
    const { data: amenities, isLoading: isAmenitiesLoading } = useBuildingAmenities(buildingId, { enabled: open });
    const { data: unit, isLoading: isUnitLoading } = useBuildingUnit(buildingId, unitId || "", { enabled: open && isEditMode });
    const { data: occupancies } = useBuildingOccupancies(buildingId, { enabled: open && isEditMode && Boolean(buildingId) });
    const unitAllocationsQuery = useUnitParkingAllocations(isEditMode && unitId ? unitId : "", {
        enabled: open && isEditMode && Boolean(unitId),
    });
    const vacantSlotsQuery = useParkingSlots(buildingId, {
        available: true,
        enabled: open && Boolean(buildingId),
    });
    const {
        data: vacantSlotsRaw,
        isLoading: isVacantSlotsLoading,
        error: vacantSlotsError,
        refetch: refetchVacantSlots,
    } = vacantSlotsQuery;
    const [error, setError] = useState<string | null>(null);
    const [isUnitTypeOpen, setIsUnitTypeOpen] = useState(false);
    const [unitTypeName, setUnitTypeName] = useState("");
    const [unitTypeError, setUnitTypeError] = useState<string | null>(null);
    const [amenityMode, setAmenityMode] = useState<"default" | "custom" | "none">("default");
    const [selectedAmenityIds, setSelectedAmenityIds] = useState<string[]>([]);
    const [isOwnerOpen, setIsOwnerOpen] = useState(false);
    const [ownerName, setOwnerName] = useState("");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    const [ownerAddress, setOwnerAddress] = useState("");
    const [ownerError, setOwnerError] = useState<string | null>(null);
    const [selectedVacantSlotIds, setSelectedVacantSlotIds] = useState<string[]>([]);

    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const totalSteps = steps.length;
    const currentStep = steps[stepIndex];
    const stepHeaderRef = useRef<HTMLDivElement | null>(null);

    const form = useForm<UnitFormValues>({
        resolver: zodResolver(unitSchema),
        defaultValues: {
            label: "",
            floor: undefined,
            notes: "",
            unitTypeId: "",
            ownerId: "",
            maintenancePayer: "",
            unitSize: undefined,
            unitSizeUnit: "SQ_FT",
            bedrooms: undefined,
            bathrooms: undefined,
            balcony: false,
            kitchenType: "",
            furnishedStatus: "",
            rentAnnual: undefined,
            paymentFrequency: "",
            securityDepositAmount: undefined,
            serviceChargePerUnit: undefined,
            vatApplicable: false,
            electricityMeterNumber: "",
            waterMeterNumber: "",
            gasMeterNumber: "",
        },
    });

    useEffect(() => {
        if (!open) return;
        setError(null);
        setUnitTypeError(null);
        setUnitTypeName("");
        setOwnerError(null);
        setOwnerName("");
        setOwnerEmail("");
        setOwnerPhone("");
        setOwnerAddress("");
        setStepIndex(0);
        setDirection(0);
        setAmenityMode("default");
        setSelectedAmenityIds([]);
        setSelectedVacantSlotIds([]);
        form.reset({
            label: "",
            floor: undefined,
            notes: "",
            unitTypeId: "",
            ownerId: "",
            maintenancePayer: "",
            unitSize: undefined,
            unitSizeUnit: "SQ_FT",
            bedrooms: undefined,
            bathrooms: undefined,
            balcony: false,
            kitchenType: "",
            furnishedStatus: "",
            rentAnnual: undefined,
            paymentFrequency: "",
            securityDepositAmount: undefined,
            serviceChargePerUnit: undefined,
            vatApplicable: false,
            electricityMeterNumber: "",
            waterMeterNumber: "",
            gasMeterNumber: "",
        });
    }, [open, form, isEditMode]);

    useEffect(() => {
        if (process.env.NODE_ENV === "production") return;
        if (!open) return;
        if (baseRole !== "manager") return;
        console.log("[Manager Portal] Unit sheet opened", {
            mode: isEditMode ? "edit" : "create",
            buildingId,
            unitId: unitId ?? null,
            userId: user?.id ?? null,
            orgId: selectedOrgId ?? user?.orgId ?? null,
            role,
            buildingScope: buildingScope ?? [],
            selectedBuildingId: selectedBuildingId ?? null
        });
    }, [open, isEditMode, buildingId, unitId, role, user?.id, user?.orgId, selectedOrgId, buildingScope, selectedBuildingId]);

    useEffect(() => {
        if (!open || !isEditMode || !unit) return;
        const amenityIds = Array.isArray(unit.amenityIds)
            ? unit.amenityIds
            : unit.amenities?.map((item) => item.id);
        if (amenityIds) {
            setAmenityMode(amenityIds.length ? "custom" : "none");
            setSelectedAmenityIds(amenityIds);
        } else {
            setAmenityMode("default");
            setSelectedAmenityIds([]);
        }
        form.reset({
            label: unit.label ?? "",
            floor: unit.floor ?? undefined,
            notes: unit.notes ?? "",
            unitTypeId: unit.unitTypeId ?? "",
            ownerId: unit.ownerId ?? "",
            maintenancePayer: unit.maintenancePayer ?? "",
            unitSize: unit.unitSize ?? undefined,
            unitSizeUnit: unit.unitSizeUnit ?? "SQ_FT",
            bedrooms: unit.bedrooms ?? undefined,
            bathrooms: unit.bathrooms ?? undefined,
            balcony: unit.balcony ?? false,
            kitchenType: unit.kitchenType ?? "",
            furnishedStatus: unit.furnishedStatus ?? "",
            rentAnnual: unit.rentAnnual ?? undefined,
            paymentFrequency: unit.paymentFrequency ?? "",
            securityDepositAmount: unit.securityDepositAmount ?? undefined,
            serviceChargePerUnit: unit.serviceChargePerUnit ?? undefined,
            vatApplicable: unit.vatApplicable ?? false,
            electricityMeterNumber: unit.electricityMeterNumber ?? "",
            waterMeterNumber: unit.waterMeterNumber ?? "",
            gasMeterNumber: unit.gasMeterNumber ?? "",
        });
    }, [open, isEditMode, unit, form]);

    const currentUnitAllocationSlotIds = useMemo(() => {
        const ids = new Set<string>();
        (unitAllocationsQuery.data || []).forEach((allocation) => {
            const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
            if (slotId) ids.add(String(slotId));
        });
        return ids;
    }, [unitAllocationsQuery.data]);

    useEffect(() => {
        if (!open || !isEditMode || !unitId) return;
        if (selectedVacantSlotIds.length > 0) return;
        const ids = Array.from(currentUnitAllocationSlotIds);
        if (ids.length === 0) return;
        setSelectedVacantSlotIds(ids);
    }, [currentUnitAllocationSlotIds, isEditMode, open, selectedVacantSlotIds.length, unitId]);

    const activeUnitOccupancies = useMemo(() => {
        if (!isEditMode || !unitId) return [];
        return (occupancies || []).filter(
            (occ) => occ.unitId === unitId && (occ.status === "ACTIVE" || !occ.endAt)
        );
    }, [isEditMode, occupancies, unitId]);

    const occupancyIds = useMemo(() => activeUnitOccupancies.map((occ) => occ.id).filter(Boolean), [activeUnitOccupancies]);

    const occupancyAllocationQueries = useQueries({
        queries: occupancyIds.map((occupancyId) => ({
            queryKey: ["occupancy-parking-allocations", occupancyId, true],
            queryFn: () => getOccupancyParkingAllocations(occupancyId, { active: true }),
            enabled: open && isEditMode && Boolean(occupancyId),
            staleTime: 60_000,
        })),
    });

    const vehicleQueries = useQueries({
        queries: occupancyIds.map((occupancyId) => ({
            queryKey: ["occupancy-vehicles", occupancyId],
            queryFn: () => getOccupancyVehicles(occupancyId),
            enabled: open && isEditMode && Boolean(occupancyId),
            staleTime: 60_000,
        })),
    });

    const occupancyById = useMemo(() => {
        return new Map(activeUnitOccupancies.map((occ) => [occ.id, occ]));
    }, [activeUnitOccupancies]);

    const vehiclesByOccupancyId = useMemo(() => {
        const map = new Map<string, string[]>();
        occupancyIds.forEach((occupancyId, index) => {
            const vehicles = vehicleQueries[index]?.data || [];
            const plates = vehicles.map((vehicle) => vehicle.plateNumber).filter(Boolean);
            map.set(occupancyId, plates);
        });
        return map;
    }, [occupancyIds, vehicleQueries]);

    const slotVehicleLabels = useMemo(() => {
        const map = new Map<string, string>();
        occupancyIds.forEach((occupancyId, index) => {
            const allocations = occupancyAllocationQueries[index]?.data || [];
            const occupancy = occupancyById.get(occupancyId);
            const residentLabel = occupancy?.residentName || occupancy?.residentEmail || "Resident";
            const plates = vehiclesByOccupancyId.get(occupancyId) || [];
            const vehicleLabel = plates.length > 0 ? plates.join(", ") : "No vehicle";
            allocations.forEach((allocation) => {
                const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
                if (!slotId) return;
                map.set(String(slotId), `${residentLabel}: ${vehicleLabel}`);
            });
        });
        if (map.size === 0 && activeUnitOccupancies.length > 0 && currentUnitAllocationSlotIds.size > 0) {
            const primaryOccupancy = activeUnitOccupancies[0];
            const residentLabel = primaryOccupancy?.residentName || primaryOccupancy?.residentEmail || "Resident";
            const plates = primaryOccupancy ? (vehiclesByOccupancyId.get(primaryOccupancy.id) || []) : [];
            const vehicleLabel = plates.length > 0 ? plates.join(", ") : "No vehicle";
            const fallbackLabel = `${residentLabel}: ${vehicleLabel}`;
            currentUnitAllocationSlotIds.forEach((slotId) => {
                map.set(slotId, fallbackLabel);
            });
        }
        return map;
    }, [occupancyAllocationQueries, occupancyById, occupancyIds, vehiclesByOccupancyId, activeUnitOccupancies, currentUnitAllocationSlotIds]);

    const vacantSlots = useMemo(() => {
        const apiSlots = (vacantSlotsRaw || []).filter((slot) => slot.isActive !== false);
        if (!isEditMode || !(unitAllocationsQuery.data?.length)) {
            return [...apiSlots].sort((a, b) => a.code.localeCompare(b.code));
        }
        const existingIds = new Set(apiSlots.map((slot) => slot.id));
        const allocatedAsSlots = (unitAllocationsQuery.data || [])
            .map((allocation) => {
                const slotId = allocation.slot?.id ?? allocation.parkingSlotId;
                const slot = allocation.slot;
                if (!slotId || !slot || existingIds.has(String(slotId))) return null;
                const synthesized: ParkingSlot = {
                    id: String(slotId),
                    buildingId,
                    code: slot.code ?? `Slot ${slotId}`,
                    level: slot.level ?? null,
                    type: slot.type ?? "CAR",
                    isCovered: false,
                    isActive: true,
                    createdAt: "",
                };
                return synthesized;
            })
            .filter((slot): slot is ParkingSlot => Boolean(slot));
        return [...apiSlots, ...allocatedAsSlots].sort((a, b) => a.code.localeCompare(b.code));
    }, [vacantSlotsRaw, isEditMode, unitAllocationsQuery.data, buildingId]);

    useEffect(() => {
        if (!open) return;
        if (isSingleLayout) return;
        stepHeaderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [stepIndex, open, isSingleLayout]);

    const onSubmit = async (data: UnitFormValues) => {
        setError(null);
        try {
            const payload = {
                label: data.label.trim(),
                floor: data.floor,
                notes: normalizeText(data.notes),
                unitTypeId: normalizeText(data.unitTypeId),
                ownerId: normalizeText(data.ownerId),
                maintenancePayer: parseMaintenancePayer(data.maintenancePayer),
                unitSize: data.unitSize,
                unitSizeUnit: parseUnitSizeUnit(data.unitSizeUnit),
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                balcony: data.balcony,
                kitchenType: parseKitchenType(data.kitchenType),
                furnishedStatus: parseFurnishedStatus(data.furnishedStatus),
                rentAnnual: data.rentAnnual,
                paymentFrequency: parsePaymentFrequency(data.paymentFrequency),
                securityDepositAmount: data.securityDepositAmount,
                serviceChargePerUnit: data.serviceChargePerUnit,
                vatApplicable: data.vatApplicable,
                electricityMeterNumber: normalizeText(data.electricityMeterNumber),
                waterMeterNumber: normalizeText(data.waterMeterNumber),
                gasMeterNumber: normalizeText(data.gasMeterNumber),
                amenityIds: amenityMode === "custom"
                    ? selectedAmenityIds
                    : amenityMode === "none"
                        ? []
                        : undefined,
            };
            let createdUnitId: string;
            if (isEditMode && unitId) {
                await updateUnit.mutateAsync({
                    buildingId,
                    unitId,
                    data: payload,
                });
                createdUnitId = unitId;
                toast.success("Unit updated");
            } else {
                const created = await createUnit.mutateAsync({
                    buildingId,
                    data: payload,
                });
                createdUnitId = created.id;
                toast.success("Unit added");
            }

            const selectedIdsSorted = [...selectedVacantSlotIds].sort();
            const currentIdsSorted = Array.from(currentUnitAllocationSlotIds).sort();
            const selectionChanged =
                selectedIdsSorted.length !== currentIdsSorted.length ||
                selectedIdsSorted.some((value, index) => value !== currentIdsSorted[index]);

            if (isEditMode && unitId && selectionChanged) {
                try {
                    await endAllUnitAllocations.mutateAsync({ unitId: createdUnitId, buildingId });
                } catch (endErr) {
                    const msg = endErr instanceof Error ? endErr.message : "Failed to reset unit parking allocations";
                    toast.error(msg);
                }
            }

            if (selectedVacantSlotIds.length > 0) {
                try {
                    await allocateParkingSlots.mutateAsync({
                        buildingId,
                        data: {
                            unitId: createdUnitId,
                            slotIds: selectedVacantSlotIds,
                        },
                    });
                    toast.success(`${selectedVacantSlotIds.length} parking slot${selectedVacantSlotIds.length === 1 ? "" : "s"} allocated`);
                } catch (allocErr) {
                    const msg = allocErr instanceof Error ? allocErr.message : "Failed to allocate parking slots";
                    if (allocErr instanceof Error && /already allocated|conflict|409/i.test(msg)) {
                        await refetchVacantSlots();
                        await unitAllocationsQuery.refetch();
                        toast.error("One or more slots were taken. The list has been refreshed — please reselect.");
                        return;
                    }
                    toast.error(msg);
                }
            } else if (isEditMode && unitId && selectionChanged) {
                toast.success("Unit parking allocations cleared");
            }

            /*
            if (selectedVacantSlotIds.length > 0) {
                try {
                    const freshOccupancies = await getBuildingOccupancies(buildingId);
                    const unitOccupancy = freshOccupancies.find(
                        (occ) => occ.unitId === createdUnitId && (occ.status === "ACTIVE" || !occ.endAt)
                    );
                    if (unitOccupancy) {
                        await allocateParkingSlots.mutateAsync({
                            buildingId,
                            data: {
                                occupancyId: unitOccupancy.id,
                                slotIds: selectedVacantSlotIds,
                            },
                        });
                    } else {
                        toast.error("No active occupancy found for this unit — parking slots were not allocated");
                    }
                } catch (allocErr) {
                    const msg = allocErr instanceof Error ? allocErr.message : "Failed to allocate parking slots";
                    toast.error(msg);
                }
            }
            */

            /*
            if (selectedVacantSlotIds.length > 0) {
                try {
                    const unitOccupancy = await waitForActiveOccupancy(createdUnitId);
                    if (unitOccupancy?.id) {
                        await allocateParkingSlots.mutateAsync({
                            buildingId,
                            data: {
                                occupancyId: unitOccupancy.id,
                                slotIds: selectedVacantSlotIds,
                            },
                        });
                        toast.success(`${selectedVacantSlotIds.length} parking slot${selectedVacantSlotIds.length === 1 ? "" : "s"} allocated`);
                    } else {
                        toast("Unit saved. Parking will allocate after a tenant is added.");
                    }
                } catch (allocErr) {
                    const msg = allocErr instanceof Error ? allocErr.message : "Failed to allocate parking slots";
                    toast.error(msg);
                }
            }
            */

            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error
                ? err.message
                : isEditMode
                    ? "Failed to update unit"
                    : "Failed to add unit";
            setError(message);
            toast.error(message);
        }
    };

    const isSaving = isEditMode ? updateUnit.isPending : createUnit.isPending;
    const isCreatingSlots = allocateParkingSlots.isPending || endAllUnitAllocations.isPending;

    const handleCreateUnitType = async () => {
        const trimmed = unitTypeName.trim();
        if (!trimmed) {
            setUnitTypeError("Unit type name is required.");
            return;
        }
        setUnitTypeError(null);
        try {
            const created = await createUnitType.mutateAsync({ name: trimmed, isActive: true });
            toast.success("Unit type created");
            form.setValue("unitTypeId", created.id);
            setIsUnitTypeOpen(false);
            setUnitTypeName("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create unit type";
            setUnitTypeError(message);
            toast.error(message);
        }
    };

    const handleCreateOwner = async () => {
        const trimmed = ownerName.trim();
        if (!trimmed) {
            setOwnerError("Owner name is required.");
            return;
        }
        setOwnerError(null);
        try {
            const created = await createOwner.mutateAsync({
                name: trimmed,
                email: ownerEmail.trim() || undefined,
                phone: ownerPhone.trim() || undefined,
                address: ownerAddress.trim() || undefined
            });
            toast.success("Owner created");
            form.setValue("ownerId", created.id);
            setIsOwnerOpen(false);
            setOwnerName("");
            setOwnerEmail("");
            setOwnerPhone("");
            setOwnerAddress("");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create owner";
            setOwnerError(message);
            toast.error(message);
        }
    };

    const handleNextStep = async () => {
        const fields = [...currentStep.fields];
        const isValid = fields.length ? await form.trigger(fields) : true;

        if (isValid) {
            setDirection(1);
            setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
        }
    };

    const handlePrevStep = () => {
        setDirection(-1);
        setStepIndex((prev) => Math.max(prev - 1, 0));
    };

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 20 : -20,
            opacity: 0,
        }),
    };

    const showStep = (index: number) => isSingleLayout || stepIndex === index;

    const wrapSection = (content: ReactNode, title: string, description: string) => {
        if (!isSingleLayout) return content;
        return (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
                    <p className="text-xs text-zinc-500">{description}</p>
                </div>
                {content}
            </div>
        );
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title={isEditMode ? "Edit Unit" : "Add Unit"}
            description={isEditMode ? "Update unit details for this building." : "Create a new unit for this building."}
            width="w-full sm:w-[720px] lg:w-[920px]"
        >
            <div className="flex h-full flex-col">
                {!isSingleLayout && (
                    <div className="border-b bg-zinc-50/50 px-6 py-4 backdrop-blur-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-zinc-900">{currentStep.title}</h3>
                                <p className="text-sm text-zinc-500">{currentStep.description}</p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-zinc-400">
                                <span className="font-medium text-zinc-900">{stepIndex + 1}</span>
                                <span>/</span>
                                <span>{totalSteps}</span>
                            </div>
                        </div>
                        {/* Visual Stepper */}
                        <div className="relative flex items-center justify-between">
                            <div className="absolute left-0 top-1/2 -z-10 h-0.5 w-full -translate-y-1/2 bg-zinc-200" />
                            <div
                                className="absolute left-0 top-1/2 -z-10 h-0.5 -translate-y-1/2 bg-zinc-900 transition-all duration-500 ease-in-out"
                                style={{ width: `${(stepIndex / (totalSteps - 1)) * 100}%` }}
                            />
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === stepIndex;
                                const isCompleted = index < stepIndex;

                                return (
                                    <div key={step.key} className="relative flex flex-col items-center gap-2">
                                        <div
                                            className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-300",
                                                isActive ? "border-zinc-900 text-zinc-900 scale-110 shadow-sm" :
                                                    isCompleted ? "border-zinc-900 bg-zinc-900 text-white" :
                                                        "border-zinc-200 text-zinc-300"
                                            )}
                                        >
                                            {isCompleted ? (
                                                <Check className="h-4 w-4" strokeWidth={3} />
                                            ) : (
                                                <Icon className="h-4 w-4" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-6 py-6" ref={stepHeaderRef}>
                    <Form {...form}>
                        <form
                            onSubmit={form.handleSubmit(onSubmit)}
                            className="space-y-6"
                        >
                            <MaybeAnimatePresence isSingleLayout={isSingleLayout} direction={direction}>
                                <motion.div
                                    key={isSingleLayout ? "single-layout" : stepIndex}
                                    {...(!isSingleLayout
                                        ? {
                                            custom: direction,
                                            variants,
                                            initial: "enter",
                                            animate: "center",
                                            exit: "exit",
                                            transition: { type: "spring", stiffness: 300, damping: 30 },
                                        }
                                        : {})}
                                    className="space-y-6"
                                >
                                    {showStep(0) && wrapSection(
                                        <div className="grid gap-6">
                                            <FormField
                                                control={form.control}
                                                name="label"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Unit Label</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g. 101, A-12" {...field} className="h-11" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="floor"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Floor <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    placeholder="e.g. 1"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                    className="h-11"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="notes"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Notes <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Internal notes" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-zinc-900">Vacant Parking Slots</p>
                                                        <p className="text-xs text-zinc-500">
                                                            Select available slots to include for this unit.
                                                        </p>
                                                    </div>
                                                    <div className="text-xs text-zinc-500">{selectedVacantSlotIds.length} selected</div>
                                                </div>

                                                <VirtualizedParkingSlotSelect
                                                    slots={vacantSlots || []}
                                                    selectedIds={selectedVacantSlotIds}
                                                    onSelectedIdsChange={setSelectedVacantSlotIds}
                                                    isEditMode={isEditMode}
                                                    currentUnitAllocationSlotIds={currentUnitAllocationSlotIds}
                                                    slotVehicleLabels={slotVehicleLabels}
                                                    isLoading={isVacantSlotsLoading}
                                                    error={vacantSlotsError}
                                                />
                                            </div>
                                        </div>,
                                        "Basics",
                                        "Label, floor, parking, and notes"
                                    )}

                                    {showStep(1) && wrapSection(
                                        <div className="grid gap-6">
                                            <FormField
                                                control={form.control}
                                                name="unitTypeId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <div className="flex items-center justify-between">
                                                            <FormLabel>Unit Type <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIsUnitTypeOpen(true)}
                                                                className="h-7 text-xs"
                                                            >
                                                                <Plus className="mr-1 h-3 w-3" />
                                                                New Type
                                                            </Button>
                                                        </div>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-11">
                                                                    <SelectValue placeholder="Select type" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="none">None</SelectItem>
                                                                {unitTypes?.map((type) => (
                                                                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="ownerId"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <div className="flex items-center justify-between">
                                                            <FormLabel>Owner <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setIsOwnerOpen(true)}
                                                                className="h-7 text-xs"
                                                            >
                                                                <Plus className="mr-1 h-3 w-3" />
                                                                New Owner
                                                            </Button>
                                                        </div>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-11">
                                                                    <SelectValue placeholder="Select owner" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="none">None</SelectItem>
                                                                {owners?.map((owner) => (
                                                                    <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>,
                                        "Assignments",
                                        "Connect unit to type and owner"
                                    )}

                                    {showStep(2) && wrapSection(
                                        <div className="grid gap-6">
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="maintenancePayer"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Maintenance Payer <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-11">
                                                                        <SelectValue placeholder="Select payer" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {maintenancePayerOptions.map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="kitchenType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Kitchen Type <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-11">
                                                                        <SelectValue placeholder="Select type" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    {kitchenTypeOptions.map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="unitSize"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Unit Size <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <div className="flex gap-2">
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                        className="h-11"
                                                                    />
                                                                </FormControl>
                                                                <FormField
                                                                    control={form.control}
                                                                    name="unitSizeUnit"
                                                                    render={({ field: unitField }) => (
                                                                        <Select onValueChange={unitField.onChange} defaultValue={unitField.value}>
                                                                            <FormControl>
                                                                                <SelectTrigger className="h-11 w-[120px]">
                                                                                    <SelectValue placeholder="Unit" />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                <SelectItem value="none">None</SelectItem>
                                                                                {unitSizeUnitOptions.map((opt) => (
                                                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                />
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="furnishedStatus"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Furnished Status <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-11">
                                                                        <SelectValue placeholder="Select status" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    {furnishedStatusOptions.map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="bedrooms"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Bedrooms <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                    className="h-11"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="bathrooms"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Bathrooms <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    value={field.value ?? ""}
                                                                    onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                    className="h-11"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>,
                                        "Specs",
                                        "Size, layout, configuration"
                                    )}

                                    {showStep(3) && wrapSection(
                                        <div className="grid gap-6">
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="rentAnnual"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Annual Rent <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                        className="h-11 pl-7"
                                                                    />
                                                                </FormControl>
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="paymentFrequency"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Payment Frequency <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-11">
                                                                        <SelectValue placeholder="Select frequency" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="none">None</SelectItem>
                                                                    {paymentFrequencyOptions.map((opt) => (
                                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="grid gap-6 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="securityDepositAmount"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Security Deposit <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                        className="h-11 pl-7"
                                                                    />
                                                                </FormControl>
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="serviceChargePerUnit"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Service Charge <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                                                        className="h-11 pl-7"
                                                                    />
                                                                </FormControl>
                                                            </div>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>,
                                        "Financials",
                                        "Rent, deposits, charges"
                                    )}

                                    {showStep(4) && wrapSection(
                                        <div className="grid gap-6">
                                            <FormField
                                                control={form.control}
                                                name="electricityMeterNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Electricity Meter <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Meter #" {...field} className="h-11" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="waterMeterNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Water Meter <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Meter #" {...field} className="h-11" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="gasMeterNumber"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Gas Meter <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Meter #" {...field} className="h-11" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>,
                                        "Utilities",
                                        "Track active meters"
                                    )}

                                    {showStep(5) && wrapSection(
                                        <div className="grid gap-6">
                                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                                <FormField
                                                    control={form.control}
                                                    name="balcony"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center gap-3 space-y-0">
                                                            <FormControl>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!field.value}
                                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                                    className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1">
                                                                <FormLabel className="text-base">Has Balcony?</FormLabel>
                                                                <p className="text-sm text-zinc-500">Check if this unit allows balcony access.</p>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                                <FormField
                                                    control={form.control}
                                                    name="vatApplicable"
                                                    render={({ field }) => (
                                                        <FormItem className="flex items-center gap-3 space-y-0">
                                                            <FormControl>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!field.value}
                                                                    onChange={(e) => field.onChange(e.target.checked)}
                                                                    className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                                                />
                                                            </FormControl>
                                                            <div className="space-y-1">
                                                                <FormLabel className="text-base">VAT Applicable?</FormLabel>
                                                                <p className="text-sm text-zinc-500">Enable if Value Added Tax applies to rent.</p>
                                                            </div>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>,
                                        "Compliance",
                                        "Additional attributes"
                                    )}

                                    {showStep(6) && wrapSection(
                                        <div className="space-y-6">
                                            <div className="grid gap-4 sm:grid-cols-3">
                                                <label className={cn(
                                                    "cursor-pointer rounded-xl border p-4 transition-all hover:border-zinc-300",
                                                    amenityMode === "default"
                                                        ? "border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900"
                                                        : "border-zinc-200 bg-white"
                                                )}>
                                                    <input
                                                        type="radio"
                                                        name="amenityMode"
                                                        value="default"
                                                        checked={amenityMode === "default"}
                                                        onChange={() => setAmenityMode("default")}
                                                        className="sr-only"
                                                    />
                                                    <div className="font-medium text-zinc-900">Default</div>
                                                    <div className="text-sm text-zinc-500">Inherit from building</div>
                                                </label>
                                                <label className={cn(
                                                    "cursor-pointer rounded-xl border p-4 transition-all hover:border-zinc-300",
                                                    amenityMode === "custom"
                                                        ? "border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900"
                                                        : "border-zinc-200 bg-white"
                                                )}>
                                                    <input
                                                        type="radio"
                                                        name="amenityMode"
                                                        value="custom"
                                                        checked={amenityMode === "custom"}
                                                        onChange={() => setAmenityMode("custom")}
                                                        className="sr-only"
                                                    />
                                                    <div className="font-medium text-zinc-900">Custom</div>
                                                    <div className="text-sm text-zinc-500">Manually select</div>
                                                </label>
                                                <label className={cn(
                                                    "cursor-pointer rounded-xl border p-4 transition-all hover:border-zinc-300",
                                                    amenityMode === "none"
                                                        ? "border-zinc-900 bg-zinc-900/5 ring-1 ring-zinc-900"
                                                        : "border-zinc-200 bg-white"
                                                )}>
                                                    <input
                                                        type="radio"
                                                        name="amenityMode"
                                                        value="none"
                                                        checked={amenityMode === "none"}
                                                        onChange={() => setAmenityMode("none")}
                                                        className="sr-only"
                                                    />
                                                    <div className="font-medium text-zinc-900">None</div>
                                                    <div className="text-sm text-zinc-500">No amenities</div>
                                                </label>
                                            </div>

                                            {amenityMode === "custom" && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: "auto" }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                                        {isAmenitiesLoading ? (
                                                            <p className="text-sm text-zinc-500">Loading amenities...</p>
                                                        ) : amenities && amenities.length > 0 ? (
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                {amenities.map(amenity => (
                                                                    <label key={amenity.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 transition-colors hover:bg-zinc-100">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedAmenityIds.includes(amenity.id)}
                                                                            onChange={(e) => {
                                                                                if (e.target.checked) setSelectedAmenityIds([...selectedAmenityIds, amenity.id]);
                                                                                else setSelectedAmenityIds(selectedAmenityIds.filter(id => id !== amenity.id));
                                                                            }}
                                                                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                                                                        />
                                                                        <span className="text-sm text-zinc-900">{amenity.name}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-zinc-500">No amenities available.</p>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>,
                                        "Amenities",
                                        "Assign amenities"
                                    )}

                                    {error && (
                                        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                            {error}
                                        </div>
                                    )}
                                </motion.div>
                            </MaybeAnimatePresence>
                        </form>
                    </Form>
                </div>

                <div className="border-t bg-white px-6 py-4">
                    {isSingleLayout ? (
                        <div className="flex items-center justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isSaving || isUnitLoading || isCreatingSlots}
                            >
                                {isEditMode ? (isSaving ? "Saving..." : "Save Changes") : (isSaving ? "Adding..." : "Create Unit")}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handlePrevStep}
                                disabled={stepIndex === 0}
                                className="gap-2"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Back
                            </Button>
                            <div className="flex items-center gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                {stepIndex === totalSteps - 1 ? (
                                    <Button
                                        onClick={form.handleSubmit(onSubmit)}
                                        disabled={isSaving || isUnitLoading || isCreatingSlots}
                                        className="gap-2"
                                    >
                                        {isEditMode ? (isSaving ? "Saving..." : "Save Changes") : (isSaving ? "Adding..." : "Create Unit")}
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        onClick={handleNextStep}
                                        className="gap-2"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sub-modals for creating Unit Type and Owner using Dialog */}
            <Dialog open={isUnitTypeOpen} onOpenChange={setIsUnitTypeOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Unit Type</DialogTitle>
                        <DialogDescription>Define a new unit type categorization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={unitTypeName}
                                onChange={e => setUnitTypeName(e.target.value)}
                                placeholder="e.g. Studio, 1BHK"
                            />
                        </div>
                        {unitTypeError && <p className="text-sm text-rose-600">{unitTypeError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUnitTypeOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateUnitType} disabled={createUnitType.isPending}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isOwnerOpen} onOpenChange={setIsOwnerOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Owner</DialogTitle>
                        <DialogDescription>Register a new owner in the system.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                                value={ownerName}
                                onChange={e => setOwnerName(e.target.value)}
                                placeholder="John Doe"
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Email <span className="text-zinc-400 font-normal">(Optional)</span></Label>
                                <Input
                                    type="email"
                                    value={ownerEmail}
                                    onChange={e => setOwnerEmail(e.target.value)}
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Phone <span className="text-zinc-400 font-normal">(Optional)</span></Label>
                                <Input
                                    value={ownerPhone}
                                    onChange={e => setOwnerPhone(e.target.value)}
                                    placeholder="+1 234 567 890"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Address <span className="text-zinc-400 font-normal">(Optional)</span></Label>
                            <Input
                                value={ownerAddress}
                                onChange={e => setOwnerAddress(e.target.value)}
                                placeholder="123 Main St"
                            />
                        </div>
                        {ownerError && <p className="text-sm text-rose-600">{ownerError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOwnerOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateOwner} disabled={createOwner.isPending}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </SlideOver>
    );
}
