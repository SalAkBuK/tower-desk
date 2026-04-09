"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useUpdateMyProfile } from "@/lib/queries";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Loader2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";

interface ProfileSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
    const { user } = useAuth();
    const updateProfile = useUpdateMyProfile();
    const [name, setName] = useState(user?.name ?? "");
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setName(user?.name ?? "");
        setAvatarUrl(user?.avatarUrl ?? "");
        setError(null);
    }, [open, user]);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file.");
            return;
        }
        setIsUploading(true);
        setError(null);
        try {
            const result = await uploadToCloudinary(file, "image");
            if (!result.url) {
                throw new Error("Upload failed to return a URL.");
            }
            setAvatarUrl(result.url);
            toast.success("Avatar uploaded");
        } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed.";
            setError(message);
            toast.error(message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const handleSave = async () => {
        setError(null);
        try {
            await updateProfile.mutateAsync({
                name: name.trim() || undefined,
                avatarUrl: avatarUrl || undefined,
            });
            toast.success("Profile updated");
            onOpenChange(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update profile.";
            setError(message);
            toast.error(message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="overflow-hidden border-zinc-200 p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-zinc-200 px-6 py-5 text-left">
                    <DialogTitle className="text-base text-zinc-950">Profile</DialogTitle>
                    <DialogDescription className="text-sm text-zinc-500">
                        Update your name and avatar.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex max-h-[85vh] flex-col">
                    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-zinc-50/40 px-6 py-6">
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-zinc-900">Update personal profile</h3>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Keep your visible identity current across the management workspace.
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                                            Personal account
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Display name</p>
                                        <p className="mt-2 text-sm font-medium text-zinc-900">{name.trim() || "Not set"}</p>
                                    </div>
                                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Avatar status</p>
                                        <p className="mt-2 text-sm font-medium text-zinc-900">{avatarUrl ? "Custom avatar uploaded" : "Using initials avatar"}</p>
                                    </div>
                                </div>
                            </div>

                            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
                                <div className="mb-5 flex items-start gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600">
                                        <UserRound className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-950">Profile details</h3>
                                        <p className="mt-1 text-sm text-zinc-500">Adjust the name and avatar shown in navigation and account menus.</p>
                                    </div>
                                </div>

                                <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                                        <div className="flex flex-col items-center text-center">
                                            <Avatar className="h-24 w-24 border border-zinc-200 shadow-sm">
                                                <AvatarImage src={avatarUrl} alt={name || user?.name || "User"} />
                                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-zinc-900 text-lg text-white">
                                                    {(name || user?.name || "U").slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="mt-4 text-sm font-medium text-zinc-900">Avatar</div>
                                            <p className="mt-1 text-xs leading-5 text-zinc-500">PNG or JPG up to 5MB.</p>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                disabled={isUploading}
                                                className="hidden"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="mt-4 w-full rounded-xl"
                                            >
                                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                {isUploading ? "Uploading..." : "Upload avatar"}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Name</label>
                                        <Input
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                            placeholder="Your name"
                                            className="h-11"
                                        />
                                        <p className="text-xs text-zinc-500">This name is shown in your account menu and activity context.</p>
                                    </div>
                                </div>
                            </section>

                            {error ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-zinc-200 bg-white px-6 py-4">
                        <Button variant="outline" type="button" className="rounded-xl" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="button" className="rounded-xl" onClick={handleSave} disabled={updateProfile.isPending || isUploading}>
                            {updateProfile.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
