"use client";

import { SlideOver } from "@/components/common/SlideOver";
import { useAddRequestComment, useAdminUsers, useAssignRequest, useRequest, useUpdateRequestStatus, useUsers } from "@/lib/queries";
import { RequestStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, Paperclip, User, Calendar, Building2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RequestDetailSheetProps {
    requestId: string | null;
    onClose: () => void;
}

export function RequestDetailSheet({ requestId, onClose }: RequestDetailSheetProps) {
    const { role, buildingScope } = useAuth();
    const { data: request, isLoading } = useRequest(requestId || "", {
        enabled: !!requestId
    });
    const { mutate: updateStatus, isPending: isUpdating } = useUpdateRequestStatus();
    const { mutate: assignRequest, isPending: isAssigning } = useAssignRequest();
    const { mutate: addComment, isPending: isCommenting } = useAddRequestComment();
    const { data: scopedUsers } = useAdminUsers(role === 'admin' ? buildingScope : role === 'manager' ? buildingScope : []);
    const { data: allUsers } = useUsers({ enabled: role === 'superadmin' });
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [commentText, setCommentText] = useState("");

    const users = role === 'superadmin' ? allUsers : scopedUsers;
    const employees = role === 'superadmin'
        ? (users?.filter(u => u.role === 'employee') || [])
        : (users?.filter(u => u.role === 'employee' && u.buildingIds.some((bid) => buildingScope.includes(bid))) || []);
    const isOutOfScope = request && role !== 'superadmin' && request.buildingId && !buildingScope.includes(request.buildingId);
    const assignedName = request?.assignedTo?.fullName || users?.find((u) => u.id === request?.assignedEmployeeId)?.name;
    const assignedEmail = request?.assignedTo?.email || users?.find((u) => u.id === request?.assignedEmployeeId)?.email;
    const canManageRequest = role === 'manager' || role === 'superadmin';
    const isManagerLocked = role === 'manager' && !!request && (request.status === 'completed' || request.status === 'cancelled');
    const canComment = role === 'manager' && !isManagerLocked;

    useEffect(() => {
        if (!requestId) return;
        if (process.env.NODE_ENV !== "production") {
            console.log("[RequestDetailSheet] Opened for requestId:", requestId);
        }
    }, [requestId]);

    useEffect(() => {
        if (!request) return;
        if (process.env.NODE_ENV !== "production") {
            console.log("[RequestDetailSheet] Request details:", request);
        }
    }, [request]);

    useEffect(() => {
        if (!request) return;
        if (request.assignedEmployeeId) {
            setSelectedEmployeeId(request.assignedEmployeeId);
        } else {
            setSelectedEmployeeId("");
        }
    }, [request]);

    const handleStatusChange = (status: RequestStatus) => {
        if (!requestId || isManagerLocked) return;
        updateStatus({ id: requestId, status }, {
            onSuccess: () => {
                toast.success("Request status updated");
            },
            onError: () => {
                toast.error("Failed to update status");
            }
        });
    };

    const handleAssign = () => {
        if (!requestId || !selectedEmployeeId || isManagerLocked) return;
        assignRequest({ requestId, assignedToId: selectedEmployeeId }, {
            onSuccess: () => {
                toast.success("Request assigned");
            },
            onError: () => {
                toast.error("Failed to assign request");
            }
        });
    };

    const handleAddComment = () => {
        if (!requestId || isManagerLocked) return;
        const text = commentText.trim();
        if (!text) return;
        addComment({ requestId, commentText: text }, {
            onSuccess: () => {
                toast.success("Comment added");
                setCommentText("");
            },
            onError: () => {
                toast.error("Failed to add comment");
            }
        });
    };

    const statusColors: Record<RequestStatus, string> = {
        pending: "bg-yellow-100 text-yellow-800",
        assigned: "bg-purple-100 text-purple-800",
        "in-progress": "bg-blue-100 text-blue-800",
        "on-hold": "bg-gray-100 text-gray-800",
        completed: "bg-green-100 text-green-800",
        cancelled: "bg-red-100 text-red-800",
    };

    const statusLabel = (value: RequestStatus) => value.replace('-', ' ');
    const managerStatusOptions: RequestStatus[] = ['on-hold', 'completed', 'cancelled'];
    const allStatusOptions: RequestStatus[] = ['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'cancelled'];
    const statusOptions = role === 'manager' ? managerStatusOptions : allStatusOptions;
    const statusSelectOptions = request
        ? Array.from(new Set([request.status, ...statusOptions]))
        : statusOptions;
    const canSelectCurrent = request ? statusOptions.includes(request.status) : true;

    return (
        <SlideOver
            open={!!requestId}
            onOpenChange={(open) => !open && onClose()}
            title={request?.title || "Request Details"}
            description={`ID: ${requestId}`}
            width="w-[95vw] sm:w-[90vw] lg:w-[1100px] xl:w-[1200px]"
        >
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-zinc-400" />
                </div>
            ) : request && !isOutOfScope ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Main Content */}
                    <div className="lg:col-span-2 space-y-6 pl-4">
                        {/* Description */}
                        <div>
                            <h3 className="text-sm font-semibold text-zinc-900 mb-3 px-1">Description</h3>
                            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
                                <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                    {request.description}
                                </p>
                            </div>
                        </div>

                        {/* Attachments */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Paperclip className="h-4 w-4 text-zinc-500" />
                                <h3 className="text-sm font-semibold text-zinc-900">Attachments</h3>
                            </div>
                            {request.attachments && request.attachments.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {request.attachments.map((attachment) => {
                                        const isImage = attachment.contentType?.startsWith('image/');
                                        return (
                                            <a
                                                key={attachment.id}
                                                href={attachment.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 hover:border-zinc-300 hover:shadow-sm transition-all"
                                            >
                                                {isImage ? (
                                                    <img
                                                        src={attachment.fileUrl}
                                                        alt={attachment.fileName || "Attachment"}
                                                        className="h-14 w-14 rounded object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-14 w-14 items-center justify-center rounded bg-zinc-100 text-xs font-medium text-zinc-500">
                                                        FILE
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-zinc-900">
                                                        {attachment.fileName || "Attachment"}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">{attachment.contentType || "file"}</p>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-8 text-center">
                                    <Paperclip className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                                    <p className="text-sm text-zinc-500">No attachments</p>
                                </div>
                            )}
                        </div>

                        {/* Comments */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <MessageCircle className="h-4 w-4 text-zinc-500" />
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Comments ({request.comments?.length || 0})
                                </h3>
                            </div>

                            {canComment && (
                                <div className="bg-white border border-zinc-200 rounded-lg p-4 mb-4">
                                    <Textarea
                                        value={commentText}
                                        onChange={(event) => setCommentText(event.target.value)}
                                        placeholder="Add a comment..."
                                        className="min-h-[80px] border-zinc-200 focus-visible:ring-zinc-400"
                                        rows={3}
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <Button
                                            size="sm"
                                            onClick={handleAddComment}
                                            disabled={isCommenting || !commentText.trim()}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            {isCommenting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                    Posting...
                                                </>
                                            ) : "Post Comment"}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                {request.comments && request.comments.length > 0 ? (
                                    [...request.comments]
                                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                        .map((comment) => {
                                            const commenter = users?.find((u) => u.id === comment.user?.userId);
                                            const commenterName = commenter?.name || comment.user?.fullName || (comment.user?.userId ? `User ${comment.user.userId}` : "User");
                                            return (
                                                <div key={comment.id} className="bg-white border border-zinc-200 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-sm font-medium text-zinc-900">{commenterName}</span>
                                                        <span className="text-xs text-zinc-500">
                                                            {new Date(comment.createdAt).toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-zinc-700 leading-relaxed">{comment.commentText}</p>
                                                </div>
                                            );
                                        })
                                ) : (
                                    <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-8 text-center">
                                        <MessageCircle className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                                        <p className="text-sm text-zinc-500">No comments yet</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status History */}
                        <div>
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Clock className="h-4 w-4 text-zinc-500" />
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Status History ({request.statusHistory?.length || 0})
                                </h3>
                            </div>
                            {request.statusHistory && request.statusHistory.length > 0 ? (
                                <div className="space-y-2">
                                    {request.statusHistory.map((entry) => (
                                        <div key={entry.id} className="bg-white border border-zinc-200 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="font-medium text-zinc-700 capitalize">
                                                        {statusLabel(entry.oldStatus)}
                                                    </span>
                                                    <span className="text-zinc-400">→</span>
                                                    <span className="font-medium text-zinc-900 capitalize">
                                                        {statusLabel(entry.newStatus)}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-zinc-500">
                                                    {new Date(entry.changedAt).toLocaleString()}
                                                </span>
                                            </div>
                                            {entry.note && (
                                                <p className="text-xs text-zinc-600 mt-2">{entry.note}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-zinc-50 border border-dashed border-zinc-300 rounded-lg p-8 text-center">
                                    <Clock className="h-8 w-8 text-zinc-400 mx-auto mb-2" />
                                    <p className="text-sm text-zinc-500">No status history</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Summary Panel */}
                    <div className="lg:col-span-1">
                        <div className="bg-zinc-50/80 border border-zinc-200 rounded-lg p-5 space-y-5 sticky top-0">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-900 mb-4">Request Summary</h3>

                                {/* Status */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
                                        <span className="text-xs font-medium text-zinc-600">Status</span>
                                    </div>
                                    <Badge
                                        className={`${statusColors[request.status] || 'bg-zinc-100 text-zinc-800'} capitalize font-medium`}
                                        variant="outline"
                                    >
                                        {statusLabel(request.status)}
                                    </Badge>
                                </div>

                                {/* Priority */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />
                                        <span className="text-xs font-medium text-zinc-600">Priority</span>
                                    </div>
                                    <Badge
                                        variant={request.priority === 'urgent' ? "destructive" : request.priority === 'high' ? "default" : "secondary"}
                                        className="capitalize font-medium"
                                    >
                                        {request.priority}
                                    </Badge>
                                </div>

                                <Separator className="my-4" />

                                {/* Created Date */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                                        <span className="text-xs font-medium text-zinc-600">Created</span>
                                    </div>
                                    <p className="text-sm text-zinc-900">
                                        {new Date(request.createdAt).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        {new Date(request.createdAt).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                {/* Assigned To */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="h-3.5 w-3.5 text-zinc-500" />
                                        <span className="text-xs font-medium text-zinc-600">Assigned To</span>
                                    </div>
                                    {assignedName || assignedEmail ? (
                                        <div>
                                            <p className="text-sm font-medium text-zinc-900">{assignedName || "Assigned user"}</p>
                                            {assignedEmail && (
                                                <p className="text-xs text-zinc-500 mt-0.5">{assignedEmail}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-zinc-500">Unassigned</p>
                                    )}
                                </div>

                                {/* Building ID (if needed) */}
                                {request.buildingId && (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                                            <span className="text-xs font-medium text-zinc-600">Building</span>
                                        </div>
                                        <p className="text-sm text-zinc-900">{request.buildingId}</p>
                                    </div>
                                )}
                            </div>

                            {/* Management Actions */}
                            {canManageRequest && (
                                <>
                                    <Separator />
                                    <div className="space-y-4">
                                        {/* Update Status */}
                                        <div>
                                            <label className="text-xs font-semibold text-zinc-900 mb-2 block">
                                                Update Status
                                            </label>
                                            <Select
                                                value={request.status}
                                                onValueChange={(val) => handleStatusChange(val as RequestStatus)}
                                                disabled={isUpdating || isManagerLocked}
                                            >
                                                <SelectTrigger className="w-full border-zinc-300 focus:ring-zinc-400">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {statusSelectOptions.map((status) => (
                                                        <SelectItem
                                                            key={status}
                                                            value={status}
                                                            disabled={status === request.status && !canSelectCurrent}
                                                            className="capitalize"
                                                        >
                                                            {statusLabel(status)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {isManagerLocked ? (
                                                <p className="mt-2 text-xs text-zinc-500">
                                                    Completed and cancelled requests are read-only.
                                                </p>
                                            ) : role === 'manager' ? (
                                                <p className="mt-2 text-xs text-zinc-500">
                                                    You can set: On Hold, Completed, or Cancelled.
                                                </p>
                                            ) : null}
                                        </div>

                                        {/* Assign Employee */}
                                        <div>
                                            <label className="text-xs font-semibold text-zinc-900 mb-2 block">
                                                Assign To Employee
                                            </label>
                                            <Select
                                                value={selectedEmployeeId}
                                                onValueChange={setSelectedEmployeeId}
                                                disabled={isAssigning || employees.length === 0 || isManagerLocked}
                                            >
                                                <SelectTrigger className="w-full border-zinc-300 focus:ring-zinc-400">
                                                    <SelectValue placeholder={employees.length === 0 ? "No employees" : "Select employee"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {employees.map(emp => (
                                                        <SelectItem key={emp.id} value={emp.id}>
                                                            {emp.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                className="w-full mt-3 bg-blue-600 hover:bg-blue-700"
                                                onClick={handleAssign}
                                                disabled={!selectedEmployeeId || isAssigning || isManagerLocked}
                                            >
                                                {isAssigning ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                        Assigning...
                                                    </>
                                                ) : "Assign Request"}
                                            </Button>
                                            {isManagerLocked && (
                                                <p className="mt-2 text-xs text-zinc-500">
                                                    Completed and cancelled requests cannot be reassigned.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-zinc-500">Request not found or you don&apos;t have access to this request.</p>
                </div>
            )}
        </SlideOver>
    );
}
