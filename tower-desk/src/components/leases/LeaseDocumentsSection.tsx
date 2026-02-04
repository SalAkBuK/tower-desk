"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    useCreateLeaseDocument,
    useDeleteLeaseDocument,
    useLeaseDocuments,
} from "@/lib/queries";
import type { LeaseDocument, LeaseDocumentType } from "@/lib/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

interface LeaseDocumentsSectionProps {
    leaseId: string;
    readOnly?: boolean;
}

const DOCUMENT_TYPES: { value: LeaseDocumentType; label: string }[] = [
    { value: "EMIRATES_ID_COPY", label: "Emirates ID Copy" },
    { value: "PASSPORT_COPY", label: "Passport Copy" },
    { value: "SIGNED_TENANCY_CONTRACT", label: "Signed Tenancy Contract" },
    { value: "CHEQUE_COPY", label: "Cheque Copy" },
    { value: "OTHER", label: "Other" },
];

const formatBytes = (value: number) => {
    if (!Number.isFinite(value)) return "N/A";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
    return `${Math.round(value / (1024 * 102.4)) / 10} MB`;
};

export function LeaseDocumentsSection({ leaseId, readOnly = false }: LeaseDocumentsSectionProps) {
    const { data: documents, isLoading } = useLeaseDocuments(leaseId);
    const createMutation = useCreateLeaseDocument();
    const deleteMutation = useDeleteLeaseDocument();
    const [showAddForm, setShowAddForm] = useState(false);
    const [deletingDoc, setDeletingDoc] = useState<LeaseDocument | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [formState, setFormState] = useState({
        type: "OTHER" as LeaseDocumentType,
        fileName: "",
        mimeType: "",
        sizeBytes: "",
        url: "",
    });

    const resetForm = () => {
        setFormState({
            type: "OTHER",
            fileName: "",
            mimeType: "",
            sizeBytes: "",
            url: "",
        });
    };

    const handleAdd = async () => {
        const size = Number(formState.sizeBytes);
        if (!formState.fileName.trim() || !formState.mimeType.trim() || !formState.url.trim()) {
            toast.error("Upload a document first");
            return;
        }
        if (!Number.isFinite(size) || size <= 0) {
            toast.error("Enter a valid size in bytes");
            return;
        }
        try {
            await createMutation.mutateAsync({
                leaseId,
                dto: {
                    type: formState.type,
                    fileName: formState.fileName.trim(),
                    mimeType: formState.mimeType.trim(),
                    sizeBytes: size,
                    url: formState.url.trim(),
                },
            });
            toast.success("Document added");
            resetForm();
            setShowAddForm(false);
        } catch (error: any) {
            if (error.message?.includes("409")) {
                toast.error("Conflict");
            } else if (error.message?.includes("400")) {
                toast.error("Invalid request");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else if (error.message?.includes("404")) {
                toast.error("Lease not found");
            } else {
                toast.error(error.message || "Failed to add document");
            }
        }
    };

    const handleDelete = async () => {
        if (!deletingDoc) return;
        try {
            await deleteMutation.mutateAsync({ leaseId, documentId: deletingDoc.id });
            toast.success("Document deleted");
            setDeletingDoc(null);
        } catch (error: any) {
            if (error.message?.includes("404")) {
                toast.error("Document not found");
            } else if (error.message?.includes("403")) {
                toast.error("No access");
            } else {
                toast.error(error.message || "Failed to delete document");
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-zinc-900">Documents</h3>
                {!readOnly && !showAddForm && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add Document
                    </Button>
                )}
            </div>

            {showAddForm && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="docType">Type</Label>
                            <Select
                                value={formState.type}
                                onValueChange={(value) =>
                                    setFormState((prev) => ({ ...prev, type: value as LeaseDocumentType }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DOCUMENT_TYPES.map((entry) => (
                                        <SelectItem key={entry.value} value={entry.value}>
                                            {entry.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="docFile">Upload File</Label>
                            <Input
                                id="docFile"
                                type="file"
                                onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;
                                    setIsUploading(true);
                                    try {
                                        const result = await uploadToCloudinary(file, "raw");
                                        setFormState((prev) => ({
                                            ...prev,
                                            fileName: file.name,
                                            mimeType: file.type || "application/octet-stream",
                                            sizeBytes: String(file.size),
                                            url: result.url,
                                        }));
                                        toast.success("Document uploaded");
                                    } catch (error: any) {
                                        toast.error(error?.message || "Upload failed");
                                    } finally {
                                        setIsUploading(false);
                                    }
                                }}
                                disabled={isUploading}
                            />
                            {isUploading ? (
                                <div className="text-xs text-zinc-500">Uploading...</div>
                            ) : null}
                        </div>
                        <div className="space-y-2">
                            <Label>File Details</Label>
                            <div className="text-sm text-zinc-700">
                                {formState.fileName ? formState.fileName : "No file selected"}
                            </div>
                            <div className="text-xs text-zinc-500">
                                {formState.mimeType ? formState.mimeType : "—"} •{" "}
                                {formState.sizeBytes ? formatBytes(Number(formState.sizeBytes)) : "—"}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowAddForm(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={createMutation.isPending || isUploading}>
                            {createMutation.isPending ? "Adding..." : "Add Document"}
                        </Button>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="rounded-lg border border-zinc-200 p-3">
                            <Skeleton className="h-5 w-40" />
                        </div>
                    ))}
                </div>
            ) : (documents || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-6 text-center text-sm text-zinc-500">
                    No documents uploaded.
                </div>
            ) : (
                <div className="space-y-2">
                    {(documents || []).map((doc) => {
                        const isImage = doc.mimeType?.startsWith("image/");
                        return (
                            <div key={doc.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                                <div className="flex items-center gap-3">
                                    {isImage && doc.url ? (
                                        <img
                                            src={doc.url}
                                            alt={doc.fileName}
                                            className="h-10 w-10 rounded-md object-cover border border-zinc-200"
                                        />
                                    ) : (
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700">
                                            <FileText className="h-4 w-4" />
                                        </div>
                                    )}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-sm font-medium text-zinc-900">{doc.fileName}</div>
                                            <Badge variant="secondary" className="bg-zinc-100 text-zinc-700">
                                                {DOCUMENT_TYPES.find((entry) => entry.value === doc.type)?.label ?? doc.type}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                        {doc.mimeType} • {formatBytes(doc.sizeBytes)}
                                        </div>
                                        {doc.url ? (
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-blue-600 hover:underline"
                                            >
                                                View document
                                            </a>
                                        ) : null}
                                    </div>
                                </div>
                                {!readOnly && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-zinc-500 hover:text-red-600"
                                        onClick={() => setDeletingDoc(doc)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <ConfirmDialog
                open={Boolean(deletingDoc)}
                onOpenChange={(open) => !open && setDeletingDoc(null)}
                title="Delete document?"
                description={`This will remove \"${deletingDoc?.fileName || ""}\" from this lease.`}
                confirmText="Delete"
                variant="destructive"
                onConfirm={handleDelete}
            />
        </div>
    );
}
