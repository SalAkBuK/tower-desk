"use client";

import { SlideOver } from "@/components/common/SlideOver";
import { useAddRequestComment, useAdminUsers, useAssignRequest, useRequest, useUpdateRequestStatus, useUsers } from "@/lib/queries";
import { RequestStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, Paperclip, User } from "lucide-react";
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
            description={`Request ID: ${requestId}`}
        >
            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-zinc-400" />
                </div>
            ) : request && !isOutOfScope ? (
                <div className="space-y-6 text-sm">
                    <div className="flex items-center justify-between">
                        <Badge className={statusColors[request.status] || 'bg-zinc-100 text-zinc-800'} variant="outline">
                            {statusLabel(request.status)}
                        </Badge>
                        <span className="text-zinc-500">{new Date(request.createdAt).toLocaleDateString()}</span>
                    </div>

                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="bg-zinc-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="comments">
                                Comments
                                <Badge variant="secondary" className="ml-2 bg-zinc-200 text-zinc-700">
                                    {request.comments?.length || 0}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="history">
                                History
                                <Badge variant="secondary" className="ml-2 bg-zinc-200 text-zinc-700">
                                    {request.statusHistory?.length || 0}
                                </Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="mt-4 space-y-6">
                            <div>
                                <h4 className="font-semibold mb-1 text-zinc-900">Description</h4>
                                <p className="text-zinc-600 leading-relaxed bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                                    {request.description}
                                </p>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-1 text-zinc-900">Priority</h4>
                                <Badge variant={request.priority === 'urgent' ? "destructive" : "secondary"}>
                                    {request.priority}
                                </Badge>
                            </div>

                            <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                    <User className="h-4 w-4 text-zinc-500" />
                                    Assigned To
                                </div>
                                {assignedName || assignedEmail ? (
                                    <div className="mt-2 text-sm text-zinc-700">
                                        <p className="font-medium">{assignedName || "Assigned user"}</p>
                                        {assignedEmail && <p className="text-xs text-zinc-500">{assignedEmail}</p>}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-zinc-500">Unassigned</p>
                                )}
                            </div>

                            {canManageRequest && (
                                <>
                                    <Separator />

                                    <div>
                                        <h4 className="font-semibold mb-3 text-zinc-900">Update Status</h4>
                                        <Select value={request.status} onValueChange={(val) => handleStatusChange(val as RequestStatus)} disabled={isUpdating || isManagerLocked}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {statusSelectOptions.map((status) => (
                                                    <SelectItem
                                                        key={status}
                                                        value={status}
                                                        disabled={status === request.status && !canSelectCurrent}
                                                    >
                                                        {statusLabel(status)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {isManagerLocked ? (
                                            <p className="mt-2 text-xs text-zinc-500">Completed and cancelled requests are read-only.</p>
                                        ) : role === 'manager' ? (
                                            <p className="mt-2 text-xs text-zinc-500">Managers can set On Hold, Completed, or Cancelled.</p>
                                        ) : null}
                                    </div>

                                    <div>
                                        <h4 className="font-semibold mb-3 text-zinc-900">Assign To</h4>
                                        <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId} disabled={isAssigning || employees.length === 0 || isManagerLocked}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={employees.length === 0 ? "No employees available" : "Select employee"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {employees.map(emp => (
                                                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <div className="mt-2 flex justify-end">
                                            <Button
                                                size="sm"
                                                onClick={handleAssign}
                                                disabled={!selectedEmployeeId || isAssigning || isManagerLocked}
                                            >
                                                {isAssigning ? "Assigning..." : "Assign"}
                                            </Button>
                                        </div>
                                        {isManagerLocked ? (
                                            <p className="mt-2 text-xs text-zinc-500">Completed and cancelled requests cannot be reassigned.</p>
                                        ) : null}
                                    </div>
                                </>
                            )}

                            <Separator />

                            <div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                    <Paperclip className="h-4 w-4 text-zinc-500" />
                                    Attachments
                                </div>
                                {request.attachments && request.attachments.length > 0 ? (
                                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {request.attachments.map((attachment) => {
                                            const isImage = attachment.contentType?.startsWith('image/');
                                            return (
                                                <a
                                                    key={attachment.id}
                                                    href={attachment.fileUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 hover:border-zinc-300"
                                                >
                                                    {isImage ? (
                                                        <img
                                                            src={attachment.fileUrl}
                                                            alt={attachment.fileName || "Attachment"}
                                                            className="h-12 w-12 rounded object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-100 text-xs text-zinc-500">
                                                            FILE
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
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
                                    <p className="mt-2 text-sm text-zinc-500">No attachments.</p>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="comments" className="mt-4 space-y-3">
                            {canComment ? (
                                <div className="rounded-lg border border-zinc-100 bg-white p-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                        <MessageCircle className="h-4 w-4 text-zinc-500" />
                                        Add Comment
                                    </div>
                                    <Textarea
                                        value={commentText}
                                        onChange={(event) => setCommentText(event.target.value)}
                                        placeholder="Write a comment..."
                                        className="mt-3"
                                    />
                                    <div className="mt-3 flex justify-end">
                                        <Button size="sm" onClick={handleAddComment} disabled={isCommenting || !commentText.trim()}>
                                            {isCommenting ? "Posting..." : "Post Comment"}
                                        </Button>
                                    </div>
                                </div>
                            ) : null}
                            {request.comments && request.comments.length > 0 ? (
                                [...request.comments]
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                                    .map((comment) => {
                                    const commenter = users?.find((u) => u.id === comment.user?.userId);
                                    const commenterName = commenter?.name || comment.user?.fullName || (comment.user?.userId ? `User ${comment.user.userId}` : "User");
                                    return (
                                        <div key={comment.id} className="rounded-lg border border-zinc-100 bg-white p-3">
                                            <div className="flex items-center justify-between text-xs text-zinc-500">
                                                <span className="font-medium text-zinc-700">{commenterName}</span>
                                                <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="mt-2 text-sm text-zinc-700">{comment.commentText}</p>
                                        </div>
                                    );
                                    })
                            ) : (
                                <p className="text-sm text-zinc-500">No comments yet.</p>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="mt-4 space-y-3">
                            {request.statusHistory && request.statusHistory.length > 0 ? (
                                request.statusHistory.map((entry) => (
                                    <div key={entry.id} className="rounded-lg border border-zinc-100 bg-white p-3">
                                        <div className="flex items-center justify-between text-xs text-zinc-500">
                                            <span>
                                                {`${statusLabel(entry.oldStatus)} -> ${statusLabel(entry.newStatus)}`}
                                            </span>
                                            <span>{new Date(entry.changedAt).toLocaleString()}</span>
                                        </div>
                                        {entry.note ? (
                                            <p className="mt-2 text-sm text-zinc-700">{entry.note}</p>
                                        ) : (
                                            <p className="mt-2 text-sm text-zinc-400">No note provided.</p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-zinc-500">No status history.</p>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            ) : (
                <div>Request not found</div>
            )}
        </SlideOver>
    );
}
