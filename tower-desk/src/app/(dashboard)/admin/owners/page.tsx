"use client";

import { useState } from "react";
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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Owners</h1>
                    <p className="text-zinc-500 mt-1">Manage owner contacts for your organization.</p>
                </div>
                <Button onClick={() => setIsOpen(true)}>Add Owner</Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Owner Directory</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-48" />
                            <Skeleton className="h-5 w-full" />
                            <Skeleton className="h-5 w-5/6" />
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error instanceof Error ? error.message : "Failed to load owners."}
                        </div>
                    ) : !owners || owners.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                            No owners added yet.
                        </div>
                    ) : (
                        owners.map((owner) => (
                            <div key={owner.id} className="rounded-lg border border-zinc-200 px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="font-medium text-zinc-900">{owner.name}</div>
                                        <div className="text-xs text-zinc-500">ID: {owner.id}</div>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-2 text-sm text-zinc-600 md:grid-cols-2">
                                    <div>Email: {owner.email || "—"}</div>
                                    <div>Phone: {owner.phone || "—"}</div>
                                    <div className="md:col-span-2">Address: {owner.address || "—"}</div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Owner</DialogTitle>
                        <DialogDescription>Create a new owner for your organization.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Owner Name</label>
                            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Owner name" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">Email (Optional)</label>
                                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="owner@email.com" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-900">Phone (Optional)</label>
                                <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+971-..." />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Address (Optional)</label>
                            <Input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Owner address" />
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
