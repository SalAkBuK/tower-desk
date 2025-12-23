"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { SlideOver } from "@/components/common/SlideOver";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Role } from "@/lib/types";
import { useCreateUser } from "@/lib/queries";
import { toast } from "sonner";
import { useEffect } from "react";

// Schema based on Admin API but applied generally
const userSchema = z.object({
    role: z.enum(['admin', 'manager', 'tenant', 'employee']),
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Invalid email address"),
    phoneNumber: z.string()
        .trim()
        .min(7, "Phone number is required")
        .max(20, "Phone number is too long")
        .regex(/^[0-9+()\-\s.]+$/, "Phone number contains invalid characters"),
    address: z.string().trim().min(5, "Address is required"),
    nationality: z.string().trim().min(2, "Nationality is required"),
    // Password might be auto-generated or required? API example has it.
    password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal('')),
    buildingId: z.string().trim().optional(),
    unitNumber: z.string().trim().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

const roleLabels: Record<string, string> = {
    admin: "Admin",
    manager: "Manager",
    tenant: "Tenant",
    employee: "Maintenance Staff"
};

interface CreateUserSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultRole?: Role;
    lockRole?: boolean;
    hideAdminRole?: boolean;
    buildingOptions?: { id: string; name: string }[];
    defaultBuildingId?: string;
    requireBuildingAssignment?: boolean;
}

export function CreateUserSheet({
    open,
    onOpenChange,
    defaultRole = 'admin',
    lockRole = false,
    hideAdminRole = false,
    buildingOptions = [],
    defaultBuildingId,
    requireBuildingAssignment = false
}: CreateUserSheetProps) {
    const createUser = useCreateUser();
    const defaultRoleValue = (defaultRole === 'superadmin' ? 'admin' : defaultRole) as Role;
    const initialRole = hideAdminRole && defaultRoleValue === 'admin' ? 'manager' : defaultRoleValue;

    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            role: initialRole as any, // prevent superadmin creation
            fullName: "",
            email: "",
            phoneNumber: "",
            address: "",
            nationality: "",
            password: "",
            buildingId: defaultBuildingId || "",
            unitNumber: "",
        },
    });

    // Reset form when role or open changes
    useEffect(() => {
        if (open) {
            const initialBuildingId = defaultBuildingId && buildingOptions.some((b) => b.id === defaultBuildingId)
                ? defaultBuildingId
                : (buildingOptions[0]?.id || "");
            form.reset({
                role: initialRole as any,
                fullName: "",
                email: "",
                phoneNumber: "",
                address: "",
                nationality: "",
                password: "",
                buildingId: initialBuildingId,
                unitNumber: "",
            });
        }
    }, [open, defaultRole, form, defaultBuildingId, buildingOptions, initialRole]);

    const selectedRole = form.watch("role");
    const requiresBuilding = requireBuildingAssignment && (selectedRole === 'manager' || selectedRole === 'tenant' || selectedRole === 'employee');
    const showBuildingSelect = requiresBuilding && buildingOptions.length > 0;

    const onSubmit = async (data: UserFormValues) => {
        try {
            const roleValue = lockRole ? (defaultRole === 'superadmin' ? 'admin' : defaultRole) : data.role;
            const needsBuilding = requireBuildingAssignment && (roleValue === 'manager' || roleValue === 'tenant' || roleValue === 'employee');
            if (needsBuilding && !data.buildingId) {
                form.setError("buildingId", { message: "Building is required" });
                return;
            }
            if (roleValue === 'tenant' && !data.unitNumber) {
                form.setError("unitNumber", { message: "Unit number is required" });
                return;
            }
            await createUser.mutateAsync({
                role: roleValue,
                data: {
                    fullName: data.fullName,
                    email: data.email,
                    phoneNumber: data.phoneNumber,
                    address: data.address,
                    nationality: data.nationality,
                    password: data.password || undefined, // Only send if provided
                    buildingId: data.buildingId || undefined,
                    unitNumber: roleValue === 'tenant' ? data.unitNumber : undefined,
                    floorNumber: roleValue === 'tenant' ? 0 : undefined,
                    entranceDate: roleValue === 'tenant' ? new Date().toISOString() : undefined
                }
            });
            toast.success(`${roleValue} created successfully`);
            onOpenChange(false);
            form.reset();
        } catch (error) {
            toast.error("Failed to create user");
            console.error(error);
        }
    };

    return (
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Create New User"
            description="Add a new user to the system. Select the role carefully."
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="space-y-4 p-1">

                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={lockRole}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a role" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {lockRole ? (
                                            <SelectItem value={field.value}>{roleLabels[field.value] ?? field.value}</SelectItem>
                                        ) : (
                                            <>
                                                {!hideAdminRole ? <SelectItem value="admin">Admin</SelectItem> : null}
                                                <SelectItem value="manager">Manager</SelectItem>
                                                <SelectItem value="tenant">Tenant</SelectItem>
                                                <SelectItem value="employee">Maintenance Staff</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {requiresBuilding && (
                        <FormField
                            control={form.control}
                            name="buildingId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Assign Building</FormLabel>
                                    {showBuildingSelect ? (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a building" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {buildingOptions.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        {building.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <div className="text-sm text-amber-600">
                                            No buildings available to assign.
                                        </div>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="John Doe" {...field} autoComplete="off" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {selectedRole === 'tenant' && (
                        <FormField
                            control={form.control}
                            name="unitNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unit Number</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Unit 101" {...field} autoComplete="off" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="john@example.com"
                                        type="email"
                                        autoComplete="off"
                                        spellCheck={false}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                            control={form.control}
                            name="phoneNumber"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone</FormLabel>
                                    <FormControl>
                                        <Input placeholder="+1 234 567 890" type="tel" autoComplete="off" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Address</FormLabel>
                                <FormControl>
                                    <Input placeholder="123 Main St, City" autoComplete="off" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="nationality"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Nationality</FormLabel>
                                <FormControl>
                                    <Input placeholder="USA" autoComplete="off" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password (Optional)</FormLabel>
                                    <FormControl>
                                        <Input type="password" placeholder="******" autoComplete="new-password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createUser.isPending}>
                            {createUser.isPending ? "Creating..." : "Create User"}
                        </Button>
                    </div>
                </form>
            </Form>
        </SlideOver>
    );
}
