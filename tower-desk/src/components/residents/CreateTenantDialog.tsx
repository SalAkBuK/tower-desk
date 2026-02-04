"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Shield, User, Phone } from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCreateResidentWithProfile } from "@/lib/queries";

const tenantSchema = z.object({
    name: z.string().trim().min(2, "Resident name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    phone: z.string().trim().optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
    emiratesIdNumber: z.string().trim().optional().or(z.literal("")),
    passportNumber: z.string().trim().optional().or(z.literal("")),
    nationality: z.string().trim().optional().or(z.literal("")),
    dateOfBirth: z.string().optional().or(z.literal("")),
    currentAddress: z.string().trim().optional().or(z.literal("")),
    emergencyContactName: z.string().trim().optional().or(z.literal("")),
    emergencyContactPhone: z.string().trim().optional().or(z.literal("")),
});

type TenantFormValues = z.infer<typeof tenantSchema>;

interface CreateTenantDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateTenantDialog({ open, onOpenChange }: CreateTenantDialogProps) {
    const createResident = useCreateResidentWithProfile();
    const [error, setError] = useState<string | null>(null);

    const form = useForm<TenantFormValues>({
        resolver: zodResolver(tenantSchema),
        defaultValues: {
            name: "",
            email: "",
            phone: "",
            password: "",
            emiratesIdNumber: "",
            passportNumber: "",
            nationality: "",
            dateOfBirth: "",
            currentAddress: "",
            emergencyContactName: "",
            emergencyContactPhone: "",
        },
    });

    useEffect(() => {
        if (open) {
            setError(null);
            form.reset();
        }
    }, [open, form]);

    const profileFields = form.watch([
        "emiratesIdNumber",
        "passportNumber",
        "nationality",
        "dateOfBirth",
        "currentAddress",
        "emergencyContactName",
        "emergencyContactPhone",
    ]);

    const hasProfileValues = useMemo(
        () => profileFields.some((value) => Boolean(value && String(value).trim())),
        [profileFields]
    );

    const onSubmit = async (data: TenantFormValues) => {
        setError(null);
        try {
            const dateOfBirth =
                data.dateOfBirth && data.dateOfBirth.trim()
                    ? new Date(data.dateOfBirth).toISOString()
                    : undefined;

            const profile = {
                emiratesIdNumber: data.emiratesIdNumber.trim() || undefined,
                passportNumber: data.passportNumber.trim() || undefined,
                nationality: data.nationality.trim() || undefined,
                dateOfBirth,
                currentAddress: data.currentAddress.trim() || undefined,
                emergencyContactName: data.emergencyContactName.trim() || undefined,
                emergencyContactPhone: data.emergencyContactPhone.trim() || undefined,
            };

            await createResident.mutateAsync({
                data: {
                    user: {
                        name: data.name.trim(),
                        email: data.email.trim(),
                        phone: data.phone.trim() || undefined,
                        password: data.password?.trim() || undefined,
                    },
                    profile: hasProfileValues ? profile : undefined,
                },
            });

            toast.success("Tenant created");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create tenant";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add Tenant</DialogTitle>
                    <DialogDescription>
                        Create a resident user and profile without assigning a unit.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input placeholder="Resident Name" {...field} className="pl-9" />
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
                                                <Input type="email" placeholder="resident@org.com" {...field} className="pl-9" />
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
                                                <Input placeholder="+971500000000" {...field} className="pl-9" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Password <span className="text-zinc-400 font-normal">(Optional)</span>
                                    </FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                            <Input type="password" placeholder="OptionalPassword123" {...field} className="pl-9" />
                                        </div>
                                    </FormControl>
                                    <p className="mt-1 text-xs text-zinc-500">
                                        Leave blank to let the resident set their own password later.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                            <Input placeholder="784-1987-1234567-1" {...field} />
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
                                            <Input placeholder="P12345678" {...field} />
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
                                            <Input placeholder="UAE" {...field} />
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
                                        <Input placeholder="Dubai Marina" {...field} />
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
                                            <Input placeholder="John Doe" {...field} />
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
                                            <Input placeholder="+971500000001" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {error && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                                {error}
                            </div>
                        )}

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createResident.isPending}>
                                {createResident.isPending ? "Creating..." : "Create Tenant"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
