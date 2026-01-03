"use client";

import { useState } from "react";
import { Building2, Mail, MapPin, Phone, Plus, UserRound, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateOwner, useOwners } from "@/lib/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function OwnersPage() {
    const { data: owners, isLoading, error } = useOwners();
    const createOwner = useCreateOwner();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [formError, setFormError] = useState<string | null>(null);

    const resetForm = () => {
        setName("");
        setEmail("");
        setPhone("");
        setAddress("");
        setFormError(null);
    };

    const handleCreate = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setFormError("Owner name is required.");
            return;
        }
        setFormError(null);
        try {
            await createOwner.mutateAsync({
                name: trimmed,
                email: email.trim() || undefined,
                phone: phone.trim() || undefined,
                address: address.trim() || undefined,
            });
            toast.success("Owner created");
            setIsOpen(false);
            resetForm();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create owner";
            setFormError(message);
            toast.error(message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Owners</h1>
                        <p className="mt-1 text-sm text-zinc-500">Manage owner contacts and profiles for your portfolio.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                                <Building2 className="h-4 w-4 text-zinc-500" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[11px] uppercase tracking-wide text-zinc-400">Owners</span>
                                <span className="text-sm font-semibold text-zinc-900">{owners?.length || 0}</span>
                            </div>
                        </div>
                        <Button onClick={() => setIsOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Owner
                        </Button>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <Users className="h-5 w-5" />
                        </div>
                        <div className="mt-3 text-2xl font-bold text-zinc-900">{owners?.length || 0}</div>
                        <p className="text-xs text-zinc-500">Total Owners</p>
                    </div>
                </div>
            </div>

            <Card className="border-zinc-200">
                <CardHeader className="flex flex-col gap-1">
                    <CardTitle className="text-lg">Owner Directory</CardTitle>
                    <p className="text-sm text-zinc-500">Keep owner contact details up to date.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {[1, 2, 3, 4, 5, 6].map((item) => (
                                <div key={item} className="rounded-xl border border-zinc-200 bg-white p-4">
                                    <Skeleton className="h-5 w-2/3" />
                                    <Skeleton className="mt-3 h-4 w-1/2" />
                                    <Skeleton className="mt-2 h-4 w-4/5" />
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error instanceof Error ? error.message : "Failed to load owners."}
                        </div>
                    ) : !owners || owners.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center text-sm text-zinc-500">
                            <Users className="mx-auto mb-3 h-8 w-8 text-zinc-400" />
                            No owners added yet.
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {owners.map((owner) => (
                                <div key={owner.id} className="rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-zinc-600">
                                                <UserRound className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="font-medium text-zinc-900">{owner.name}</div>
                                                <div className="text-xs text-zinc-500">ID: {owner.id}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 space-y-2 text-sm text-zinc-600">
                                        <div className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-zinc-400" />
                                            <span>{owner.email || "N/A"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 text-zinc-400" />
                                            <span>{owner.phone || "N/A"}</span>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <MapPin className="h-4 w-4 text-zinc-400 mt-0.5" />
                                            <span>{owner.address || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Owner</DialogTitle>
                        <DialogDescription>Create a new owner for your organization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
                            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Owner Details</div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">Owner Name</label>
                                <div className="relative">
                                    <UserRound className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Owner name" className="pl-9" />
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-900">
                                        Email <span className="text-zinc-400 font-normal">(Optional)</span>
                                    </label>
                                    <div className="relative">
                                        <Mail className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@email.com" className="pl-9" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-900">
                                        Phone <span className="text-zinc-400 font-normal">(Optional)</span>
                                    </label>
                                    <div className="relative">
                                        <Phone className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+971-..." className="pl-9" />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">
                                    Address <span className="text-zinc-400 font-normal">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <MapPin className="h-4 w-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Owner address" className="pl-9" />
                                </div>
                            </div>
                        </div>
                        {formError ? (
                            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                {formError}
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleCreate} disabled={createOwner.isPending}>
                            {createOwner.isPending ? "Creating..." : "Create Owner"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
