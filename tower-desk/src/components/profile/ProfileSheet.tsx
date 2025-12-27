"use client";

import { useEffect, useRef, useState } from "react";
import { SlideOver } from "@/components/common/SlideOver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { useUpdateMyProfile } from "@/lib/queries";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Loader2, Upload } from "lucide-react";
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
        <SlideOver
            open={open}
            onOpenChange={onOpenChange}
            title="Profile"
            description="Update your name and avatar."
        >
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border border-zinc-200">
                        <AvatarImage src={avatarUrl} alt={name || user?.name || "User"} />
                        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
                            {(name || user?.name || "U").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-zinc-900">Avatar</div>
                        <div className="flex items-center gap-2">
                            <Input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                disabled={isUploading}
                                className="h-9"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                            >
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            </Button>
                        </div>
                        <p className="text-xs text-zinc-500">PNG or JPG up to 5MB.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-900">Name</label>
                    <Input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your name"
                    />
                </div>

                {error ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}

                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={updateProfile.isPending || isUploading}>
                        {updateProfile.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </div>
        </SlideOver>
    );
}
