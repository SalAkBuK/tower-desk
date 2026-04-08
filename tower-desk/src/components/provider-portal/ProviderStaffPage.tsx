"use client";

import { useMemo, useState } from "react";
import { KeyRound, Plus, ShieldAlert, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useCreateProviderStaff, useProviderRuntimeContext, useProviderStaff, useUpdateProviderStaff } from "@/lib/queries";

type StaffFormState = {
    email: string;
    name: string;
    phone: string;
    role: "ADMIN" | "WORKER";
    isActive: boolean;
};

const initialForm: StaffFormState = {
    email: "",
    name: "",
    phone: "",
    role: "WORKER",
    isActive: true,
};

export function ProviderStaffPage() {
    const { baseRole } = useAuth();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState<StaffFormState>(initialForm);
    const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);

    const providerContextQuery = useProviderRuntimeContext({ enabled: baseRole === "service_provider" });
    const providerAccess = providerContextQuery.data?.providers ?? [];
    const singleProvider = providerAccess.length === 1 ? providerAccess[0] : null;
    const currentUserId = providerContextQuery.data?.userId ?? "";
    const staffQuery = useProviderStaff({ enabled: baseRole === "service_provider" && Boolean(singleProvider) });
    const createStaff = useCreateProviderStaff();
    const updateStaff = useUpdateProviderStaff();

    const isAdmin = String(singleProvider?.role ?? "").toUpperCase() === "ADMIN";
    const staff = staffQuery.data ?? [];
    const activeStaffCount = useMemo(() => staff.filter((entry) => entry.membershipIsActive !== false && entry.userIsActive !== false).length, [staff]);

    const handleCreateStaff = async () => {
        try {
            const created = await createStaff.mutateAsync({
                email: form.email.trim(),
                name: form.name.trim(),
                phone: form.phone.trim() || undefined,
                role: form.role,
                isActive: form.isActive,
            });
            setLastTempPassword(created.tempPassword ?? null);
            setForm(initialForm);
            setIsCreateOpen(false);
            toast.success("Provider staff created");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to create provider staff");
        }
    };

    const handleUpdateStaff = async (userId: string, payload: { role?: "ADMIN" | "WORKER"; isActive?: boolean }) => {
        try {
            await updateStaff.mutateAsync({ userId, payload });
            toast.success("Provider staff updated");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update provider staff");
        }
    };

    if (baseRole !== "service_provider") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to provider users.</div>;
    }
    if (providerContextQuery.isLoading && !providerContextQuery.data) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Loading provider access...</div>;
    }
    if (providerAccess.length === 0) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">No provider access. `GET /provider/me` returned no active provider memberships.</div>;
    }
    if (providerAccess.length > 1) {
        return (
            <div className="rounded-3xl border border-zinc-200 bg-white p-8">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-zinc-950">Provider selection required</h1>
                        <p className="mt-2 text-sm text-zinc-500">The current backend does not support explicit provider selection for `/provider/staff` yet.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            Provider staff
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">{singleProvider?.name}</h1>
                        <p className="mt-2 max-w-2xl text-sm text-zinc-500">Manage admins and workers inside the provider team.</p>
                    </div>
                    {isAdmin ? (
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add staff
                        </Button>
                    ) : null}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><UserRoundCog className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-semibold text-zinc-950">{staff.length}</div><p className="text-xs text-zinc-500">Total staff</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><ShieldAlert className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-semibold text-zinc-950">{activeStaffCount}</div><p className="text-xs text-zinc-500">Active memberships</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><KeyRound className="h-5 w-5 text-zinc-700" /><div className="mt-3 text-2xl font-semibold text-zinc-950">{staff.filter((entry) => entry.mustChangePassword).length}</div><p className="text-xs text-zinc-500">Password reset required</p></div>
                </div>
            </section>

            {lastTempPassword ? (
                <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">Temporary password</h2>
                    <p className="mt-2 text-sm text-emerald-900">This is only returned once by the backend. Share it now.</p>
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 font-mono text-sm text-emerald-900">{lastTempPassword}</div>
                </section>
            ) : null}

            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                {!isAdmin ? (
                    <div className="mb-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                        Staff mutations are limited to provider admins.
                    </div>
                ) : null}
                <div className="overflow-hidden rounded-xl border border-zinc-200">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Staff</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Password</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffQuery.isLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">Loading provider staff...</TableCell></TableRow>
                            ) : staff.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-zinc-500">No provider staff found.</TableCell></TableRow>
                            ) : (
                                staff.map((entry) => {
                                    const isSelf = entry.userId === currentUserId;
                                    const canEditRow = isAdmin && !isSelf;
                                    return (
                                        <TableRow key={entry.userId}>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <div className="font-medium text-zinc-900">{entry.name ?? entry.email ?? entry.userId}</div>
                                                    <div className="text-xs text-zinc-500">{[entry.email, entry.phone].filter(Boolean).join(" | ") || entry.userId}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge className="bg-zinc-100 text-zinc-700">{entry.role}</Badge></TableCell>
                                            <TableCell><Badge className={entry.membershipIsActive !== false && entry.userIsActive !== false ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-700"}>{entry.membershipIsActive !== false && entry.userIsActive !== false ? "Active" : "Inactive"}</Badge></TableCell>
                                            <TableCell>{entry.mustChangePassword ? <Badge className="bg-amber-50 text-amber-700">Reset required</Badge> : <span className="text-sm text-zinc-500">Ready</span>}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" disabled={!canEditRow || updateStaff.isPending} onClick={() => handleUpdateStaff(entry.userId, { role: String(entry.role).toUpperCase() === "ADMIN" ? "WORKER" : "ADMIN" })}>
                                                        {String(entry.role).toUpperCase() === "ADMIN" ? "Make worker" : "Make admin"}
                                                    </Button>
                                                    <Button variant="outline" size="sm" disabled={!canEditRow || updateStaff.isPending} onClick={() => handleUpdateStaff(entry.userId, { isActive: !(entry.membershipIsActive !== false && entry.userIsActive !== false) })}>
                                                        {entry.membershipIsActive !== false && entry.userIsActive !== false ? "Deactivate" : "Activate"}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>

            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <SheetContent side="right" className="w-full gap-0 border-l border-zinc-200 bg-white sm:max-w-xl">
                    <SheetHeader className="border-b border-zinc-100 px-6 py-5 text-left">
                        <SheetTitle>Create provider staff</SheetTitle>
                        <SheetDescription>Creates a standalone user plus provider membership. The temporary password is only returned once.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-5 overflow-y-auto px-6 py-6">
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Email</label><Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Name</label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
                        <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Phone</label><Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Role</label>
                            <Select value={form.role} onValueChange={(value) => setForm((prev) => ({ ...prev, role: value as "ADMIN" | "WORKER" }))}>
                                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                                <SelectContent><SelectItem value="WORKER">WORKER</SelectItem><SelectItem value="ADMIN">ADMIN</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Status</label>
                            <Select value={form.isActive ? "active" : "inactive"} onValueChange={(value) => setForm((prev) => ({ ...prev, isActive: value === "active" }))}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleCreateStaff} disabled={createStaff.isPending || !form.email.trim() || !form.name.trim()}>
                                {createStaff.isPending ? "Creating..." : "Create staff"}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
