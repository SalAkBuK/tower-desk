"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAssignAdmin, useCreateBuilding } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, MapPin, Globe, Clock, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const buildingSchema = z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    city: z.string().trim().min(2, "City is required"),
    emirate: z.string().trim().optional().or(z.literal("")),
    country: z.string().trim().regex(/^[A-Za-z]{3}$/, "Country must be a 3-letter code").optional().or(z.literal("")),
    timezone: z.string().trim().optional().or(z.literal("")),
    floors: z.number().int().min(1, "Floors must be at least 1").optional(),
    unitsCount: z.number().int().min(1, "Units must be at least 1").optional(),
});

type BuildingFormValues = z.infer<typeof buildingSchema>;

interface CreateBuildingSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    assignToAdminId?: string;
    onAssigned?: (buildingId: string) => void;
}

const steps = [
    {
        key: "identity",
        title: "Identity",
        description: "Name and location basics",
        icon: Building2,
        fields: ["name", "city"],
    },
    {
        key: "locale",
        title: "Locale",
        description: "Region and timezone settings",
        icon: Globe,
        fields: ["emirate", "country", "timezone"],
    },
] as const;

export function CreateBuildingSheet({ open, onOpenChange, assignToAdminId, onAssigned }: CreateBuildingSheetProps) {
    const createBuilding = useCreateBuilding();
    const assignAdmin = useAssignAdmin();

    const [stepIndex, setStepIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const totalSteps = steps.length;
    const currentStep = steps[stepIndex];
    const stepHeaderRef = useRef<HTMLDivElement | null>(null);

    const form = useForm<BuildingFormValues>({
        resolver: zodResolver(buildingSchema),
        defaultValues: {
            name: "",
            city: "",
            emirate: "",
            country: "ARE",
            timezone: "Asia/Dubai",
            floors: undefined,
            unitsCount: undefined,
        },
    });

    useEffect(() => {
        if (open) {
            setStepIndex(0);
            setDirection(0);
            form.reset({
                name: "",
                city: "",
                emirate: "",
                country: "ARE",
                timezone: "Asia/Dubai",
                floors: undefined,
                unitsCount: undefined,
            });
        }
    }, [open, form]);

    const onSubmit = async (data: BuildingFormValues) => {
        try {
            const payload = {
                name: data.name.trim(),
                city: data.city.trim(),
                emirate: data.emirate?.trim() || undefined,
                country: data.country?.trim().toUpperCase() || undefined,
                timezone: data.timezone?.trim() || undefined,
                floors: data.floors,
                unitsCount: data.unitsCount,
            };
            const building = await createBuilding.mutateAsync(payload);

            if (assignToAdminId) {
                try {
                    await assignAdmin.mutateAsync({ buildingId: building.id, adminId: assignToAdminId });
                    onAssigned?.(building.id);
                    toast.success("Building created and assigned");
                } catch (error) {
                    toast.error("Building created but assignment failed");
                    console.error(error);
                }
            } else {
                toast.success("Building created successfully");
            }
            onOpenChange(false);
        } catch (error) {
            toast.error("Failed to create building");
            console.error(error);
        }
    };

    const handleNextStep = async () => {
        const fields = [...currentStep.fields];
        const isValid = await form.trigger(fields);

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

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create New Building"
            description="Add a new building to the system."
            width="w-full sm:w-[600px]"
        >
            <div className="flex h-full flex-col">
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
                    <div className="relative flex items-center justify-between px-2">
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

                <div className="flex-1 overflow-y-auto px-6 py-6" ref={stepHeaderRef}>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <AnimatePresence mode="wait" initial={false} custom={direction}>
                                <motion.div
                                    key={stepIndex}
                                    custom={direction}
                                    variants={variants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    className="space-y-6"
                                >
                                    {stepIndex === 0 && (
                                        <div className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Building Name</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                <Input placeholder="e.g. Tower One" {...field} className="pl-9 h-11" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="city"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>City</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                <Input placeholder="e.g. Dubai" {...field} className="pl-9 h-11" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    {stepIndex === 1 && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="country"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Country Code <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                    <Input placeholder="ARE" maxLength={3} {...field} className="pl-9 h-11 uppercase" />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="emirate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>State/Emirate <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Dubai" {...field} className="h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="timezone"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Timezone <span className="text-zinc-400 font-normal">(Optional)</span></FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                                                <Input placeholder="Asia/Dubai" {...field} className="pl-9 h-11" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                </motion.div>
                            </AnimatePresence>
                        </form>
                    </Form>
                </div>

                <div className="border-t bg-white px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {stepIndex > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handlePrevStep}
                                    className="gap-2"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {stepIndex === totalSteps - 1 ? (
                                <Button
                                    onClick={form.handleSubmit(onSubmit)}
                                    disabled={createBuilding.isPending || assignAdmin.isPending}
                                    className="gap-2 min-w-[140px]"
                                >
                                    {createBuilding.isPending || assignAdmin.isPending ? "Creating..." : "Create Building"}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    onClick={handleNextStep}
                                    className="gap-2 min-w-[100px]"
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </SlideOver>
    );
}
