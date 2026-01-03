"use client";

import { useAddRequestComment, useAdminUsers, useAssignRequest, useUpdateRequestStatus, useRequest, useUsers, useBuildingResidents } from "@/lib/queries";
import { RequestStatus } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, Paperclip, Building2, Clock, AlertCircle, FileText, Activity, Info, ChevronRight, Hash, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { statusLabels, statusStyles } from "@/components/requests/requestDisplay";

interface RequestDetailSheetProps {
    requestId: string | null;
    buildingId?: string | null;
    buildingNameById?: Record<string, string>;
    onClose: () => void;
}

const TAB_Config = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'meta', label: 'Details', icon: Info },
];

export function RequestDetailSheet({ requestId, buildingId, buildingNameById, onClose }: RequestDetailSheetProps) {
    const { role, buildingScope } = useAuth();
    const { data: request, isLoading } = useRequest(requestId || "", buildingId ?? undefined, {
        enabled: !!requestId
    });
    const { mutate: updateStatus, isPending: isUpdating } = useUpdateRequestStatus();
    const { mutate: assignRequest, isPending: isAssigning } = useAssignRequest();
    const { mutate: addComment, isPending: isCommenting } = useAddRequestComment();

    const [activeTab, setActiveTab] = useState('overview');
    const [commentText, setCommentText] = useState("");

    // --- Derived Data & Helpers ---
    const { data: scopedUsers } = useAdminUsers(role === 'admin' ? buildingScope : role === 'manager' ? buildingScope : []);
    const { data: allUsers } = useUsers({ enabled: role === 'superadmin' });
    const users = role === 'superadmin' ? allUsers : scopedUsers;
    const buildingIdForResident = request?.buildingId ?? buildingId ?? "";
    const { data: residents } = useBuildingResidents(buildingIdForResident, { enabled: !!buildingIdForResident });
    const employees = role === 'superadmin'
        ? (users?.filter(u => u.role === 'employee') || [])
        : (users?.filter(u => u.role === 'employee' && u.buildingIds.some((bid) => buildingScope.includes(bid))) || []);

    const isOutOfScope = request && role !== 'superadmin' && request.buildingId && !buildingScope.includes(request.buildingId);

    // Assignee Logic
    const assignedUser = request?.assignedTo || users?.find((u) => u.id === request?.assignedEmployeeId);
    const assignedName = assignedUser?.fullName || assignedUser?.name;
    const assignedInitials = assignedName ? assignedName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "UN";

    // Location Logic
    const unitLabel = request?.unit?.label ?? request?.unit?.number ?? request?.unit?.id;
    const unitFloor = request?.unit?.floor;
    const buildingName = request?.buildingId ? (buildingNameById?.[request.buildingId] ?? request.buildingId) : null;
    const residentUserId = (request as { residentId?: string } | null)?.residentId ?? request?.createdByTenantId;
    const residentRecord = residents?.find((resident) => resident.userId === residentUserId);
    const residentName = residentRecord?.name || residentUserId || "N/A";

    const isManagerLocked = role === 'manager' && !!request && (request.status === 'completed' || request.status === 'cancelled');
    const canComment = role === 'manager' && !isManagerLocked;
    const managerAllowedStatuses: RequestStatus[] = ['in-progress', 'completed'];
    const allStatusOptions: RequestStatus[] = ['pending', 'assigned', 'in-progress', 'on-hold', 'completed', 'cancelled'];
    const statusSelectOptions = request
        ? (role === 'manager'
            ? Array.from(new Set([request.status, ...managerAllowedStatuses]))
            : allStatusOptions)
        : allStatusOptions;

    // Timeline Construction
    const timeline = useMemo(() => {
        if (!request) return [];
        const comments = (request.comments || []).map(c => ({
            type: 'comment' as const,
            id: c.id,
            data: c,
            date: new Date(c.createdAt)
        }));
        const history = (request.statusHistory || []).map(h => ({
            type: 'status' as const,
            id: h.id,
            data: h,
            date: new Date(h.changedAt)
        }));
        return [...comments, ...history].sort((a, b) => a.date.getTime() - b.date.getTime()); // Chronological for chat view
    }, [request]);

    // --- Handlers ---
    const handleStatusChange = (status: RequestStatus) => {
        if (!requestId || isManagerLocked) return;
        if (role === 'manager' && !managerAllowedStatuses.includes(status)) return;
        updateStatus({ id: requestId, status, buildingId: request?.buildingId ?? buildingId }, {
            onSuccess: () => toast.success(`Status updated`),
            onError: () => toast.error("Failed to update status")
        });
    };

    const handleAssign = (employeeId: string) => {
        if (!requestId || isManagerLocked) return;
        assignRequest({ requestId, assignedToId: employeeId, buildingId: request?.buildingId ?? buildingId }, {
            onSuccess: () => toast.success("Request assigned"),
            onError: () => toast.error("Failed to assign request")
        });
    };

    const handleAddComment = () => {
        if (!requestId || isManagerLocked) return;
        const text = commentText.trim();
        if (!text) return;
        addComment({ requestId, commentText: text, buildingId: request?.buildingId ?? buildingId }, {
            onSuccess: () => {
                toast.success("Comment posted");
                setCommentText("");
            },
            onError: () => toast.error("Failed to post comment")
        });
    };

    const getInitials = (name?: string) => name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "??";

    return (
        <Dialog open={!!requestId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-zinc-50/50 rounded-2xl shadow-2xl border-zinc-200/50 outline-none">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center bg-white/50 backdrop-blur-sm">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
                    </div>
                ) : request && !isOutOfScope ? (
                    <>
                        {/* --- Premium Header --- */}
                        <div className="bg-white border-b border-zinc-200/60 px-8 py-6 shrink-0 z-10 relative">
                            <div className="flex flex-col gap-6">
                                {/* Top Row: Breadcrumbs & Actions */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                                        <Hash className="h-3 w-3" />
                                        <span>{request.id.slice(0, 8)}</span>
                                        <ChevronRight className="h-3 w-3 text-zinc-300" />
                                        <span className="uppercase tracking-wider font-semibold text-zinc-500">REQUEST</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Status Pill Dropdown */}
                                        <Select
                                            value={request.status}
                                            onValueChange={(val) => handleStatusChange(val as RequestStatus)}
                                            disabled={isUpdating || isManagerLocked}
                                        >
                                            <SelectTrigger
                                                className={`h-8 border-0 shadow-none ring-1 ring-inset w-auto min-w-[140px] px-3 rounded-full transition-all hover:ring-2 ${statusStyles[request.status]} bg-transparent`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-1.5 w-1.5 rounded-full bg-current`} />
                                                    <span className="text-xs font-semibold uppercase tracking-wide truncate">{statusLabels[request.status]}</span>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent align="end" className="w-[180px]">
                                                {statusSelectOptions.map((st) => (
                                                    <SelectItem
                                                        key={st}
                                                        value={st}
                                                        className="capitalize text-xs font-medium"
                                                        disabled={role === 'manager' && !managerAllowedStatuses.includes(st)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className={`h-1.5 w-1.5 rounded-full ${statusStyles[st].split(' ')[0].replace('bg-', 'bg-')}`} />
                                                            {statusLabels[st]}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <Separator orientation="vertical" className="h-6 bg-zinc-200" />

                                        {/* Priority Badge */}
                                        <div className={cn(
                                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                            request.priority === 'urgent' ? "bg-rose-50 border-rose-100 text-rose-700" :
                                                request.priority === 'high' ? "bg-orange-50 border-orange-100 text-orange-700" :
                                                    "bg-zinc-50 border-zinc-200 text-zinc-600"
                                        )}>
                                            {request.priority}
                                        </div>
                                    </div>
                                </div>

                                {/* Main Title Area */}
                                <div className="flex items-start justify-between gap-8">
                                    <DialogTitle className="text-2xl font-bold text-zinc-900 tracking-tight leading-tight">
                                        {request.title}
                                    </DialogTitle>

                                    {/* Assignee Avatar Group */}
                                    <Select
                                        value={request.assignedEmployeeId || "unassigned"}
                                        onValueChange={(val) => val === "unassigned" ? {} : handleAssign(val)}
                                        disabled={isAssigning || isManagerLocked}
                                    >
                                        <SelectTrigger className="h-10 w-auto min-w-[180px] bg-zinc-50 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 rounded-lg px-3 transition-colors text-left">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-6 w-6 border border-zinc-200">
                                                    <AvatarFallback className="text-[9px] bg-white text-zinc-600 font-bold">{assignedInitials}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider leading-none">Assignee</span>
                                                    <span className="text-xs font-semibold text-zinc-900 leading-none truncate max-w-[120px]">{assignedName || "Unassigned"}</span>
                                                </div>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            <SelectItem value="unassigned" className="text-zinc-500 italic">No Assignee</SelectItem>
                                            {employees.map(emp => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-5 w-5">
                                                            <AvatarFallback className="text-[9px]">{getInitials(emp.name)}</AvatarFallback>
                                                        </Avatar>
                                                        <span>{emp.name}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Custom Tabs Navigation */}
                            <div className="flex items-center gap-8 mt-8 border-b border-zinc-100 pb-0">
                                {TAB_Config.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "relative pb-4 text-sm font-medium transition-colors flex items-center gap-2",
                                            activeTab === tab.id ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
                                        )}
                                    >
                                        <tab.icon className="h-4 w-4" />
                                        {tab.label}
                                        {activeTab === tab.id && (
                                            <motion.div
                                                layoutId="activeTab"
                                                className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900 rounded-t-full"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* --- Main Content Body --- */}
                        <div className="flex-1 overflow-y-auto bg-zinc-50/30 p-8 scroll-smooth">
                            <AnimatePresence mode="wait">
                                {activeTab === 'overview' && (
                                    <motion.div
                                        key="overview"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="space-y-8 max-w-4xl mx-auto"
                                    >
                                        {/* Description Card */}
                                        <div className="bg-white rounded-xl border border-zinc-200/60 p-6 shadow-sm">
                                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                <FileText className="h-3 w-3" /> Description
                                            </h3>
                                            <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap text-sm">{request.description}</p>
                                        </div>

                                        {/* Grid Layout for Attachments & Meta */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Attachments */}
                                            <div className="bg-white rounded-xl border border-zinc-200/60 p-6 shadow-sm h-full">
                                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Paperclip className="h-3 w-3" /> Attachments
                                                </h3>
                                                {request.attachments && request.attachments.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {request.attachments.map((att) => {
                                                            const fileName = att.fileName || "Attachment";
                                                            const extension = fileName.includes(".")
                                                                ? fileName.split(".").pop()
                                                                : att.contentType?.split("/").pop() || "file";
                                                            return (
                                                                <a
                                                                    key={att.id}
                                                                    href={att.fileUrl}
                                                                    target="_blank"
                                                                    className="flex items-center gap-3 p-3 rounded-lg border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 hover:border-zinc-200 transition-all group"
                                                                >
                                                                    <div className="h-10 w-10 flex items-center justify-center bg-white rounded border border-zinc-200 text-zinc-400 group-hover:text-zinc-600 transition-colors">
                                                                        <Paperclip className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-medium text-zinc-900 truncate">{fileName}</p>
                                                                        <p className="text-[10px] text-zinc-500 font-mono uppercase">{extension}</p>
                                                                    </div>
                                                                    <div className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        Download
                                                                    </div>
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-zinc-400 italic py-6 text-center border-2 border-dashed border-zinc-100 rounded-lg">No attachments</div>
                                                )}
                                            </div>

                                            {/* Quick Meta */}
                                            <div className="bg-white rounded-xl border border-zinc-200/60 p-6 shadow-sm h-full">
                                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                    <Building2 className="h-3 w-3" /> Location & Context
                                                </h3>
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                                                        <span className="text-sm text-zinc-500">Building</span>
                                                        <span className="text-sm font-medium text-zinc-900">{buildingName || "N/A"}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                                                        <span className="text-sm text-zinc-500">Unit</span>
                                                        <span className="text-sm font-medium text-zinc-900">{unitLabel || "N/A"}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between py-2 border-b border-zinc-50">
                                                        <span className="text-sm text-zinc-500">Resident</span>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="h-5 w-5">
                                                                <AvatarFallback className="text-[8px]">{getInitials(residentName)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="text-sm font-medium text-zinc-900 truncate max-w-[140px]">{residentName}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'activity' && (
                                    <motion.div
                                        key="activity"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="max-w-3xl mx-auto h-full flex flex-col"
                                    >
                                        <div className="flex-1 space-y-8 pb-8">
                                            {timeline.length === 0 && (
                                                <div className="text-center py-12 text-zinc-400">
                                                    <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                                    <p>No activity yet.</p>
                                                </div>
                                            )}

                                            {timeline.map((item) => {
                                                if (item.type === 'status') {
                                                    return (
                                                        <div key={item.id} className="flex justify-center items-center gap-4 my-8">
                                                            <div className="h-px bg-zinc-200 flex-1 max-w-[100px]" />
                                                            <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-100/50 px-3 py-1 rounded-full border border-zinc-200/50">
                                                                <Clock className="h-3 w-3" />
                                                                <span className="font-mono">{item.date.toLocaleDateString()}</span>
                                                                <span>•</span>
                                                                <span className="text-zinc-600 font-medium">Status changed from {statusLabels[item.data.oldStatus]} to {statusLabels[item.data.newStatus]}</span>
                                                            </div>
                                                            <div className="h-px bg-zinc-200 flex-1 max-w-[100px]" />
                                                        </div>
                                                    );
                                                }

                                                // Comment
                                                const user = users?.find(u => u.id === item.data.user?.userId);
                                                const userName = user?.name || item.data.user?.fullName || "User";

                                                return (
                                                    <div key={item.id} className="flex gap-4 group">
                                                        <Avatar className="h-10 w-10 shrink-0 border-2 border-white shadow-sm">
                                                            <AvatarFallback className="bg-zinc-100 text-zinc-600 text-xs font-bold">
                                                                {getInitials(userName)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex-1 max-w-[80%]">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-sm font-bold text-zinc-900">{userName}</span>
                                                                <span className="text-[10px] text-zinc-400 font-medium">{item.date.toLocaleString()}</span>
                                                            </div>
                                                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-zinc-100 shadow-sm text-zinc-700 text-sm leading-relaxed relative group-hover:shadow-md transition-shadow">
                                                                {item.data.commentText}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Sticky Comment Area */}
                                        {canComment && (
                                            <div className="sticky bottom-0 bg-white/80 p-4 border border-zinc-200 rounded-xl shadow-lg backdrop-blur-md">
                                                <div className="flex gap-4">
                                                    <Avatar className="h-8 w-8 mt-1">
                                                        <AvatarFallback className="bg-zinc-900 text-white text-xs font-bold">ME</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 flex gap-2">
                                                        <Textarea
                                                            placeholder="Type your message..."
                                                            className="min-h-[44px] max-h-[120px] bg-transparent border-0 focus-visible:ring-0 resize-none py-2 px-0 text-sm"
                                                            value={commentText}
                                                            onChange={(e) => setCommentText(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault();
                                                                    handleAddComment();
                                                                }
                                                            }}
                                                        />
                                                        <div className="flex items-end pb-1">
                                                            <Button
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-transform active:scale-95"
                                                                onClick={handleAddComment}
                                                                disabled={isCommenting || !commentText.trim()}
                                                            >
                                                                {isCommenting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {activeTab === 'meta' && (
                                    <motion.div
                                        key="meta"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                        className="max-w-2xl mx-auto space-y-6"
                                    >
                                        {/* Meta Tab Content from prev implementation - just styled cleaner */}
                                        <div className="bg-white rounded-xl border border-zinc-200/60 overflow-hidden shadow-sm">
                                            <div className="p-4 bg-zinc-50/50 border-b border-zinc-100 flex items-center gap-2">
                                                <Info className="h-4 w-4 text-zinc-400" />
                                                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">System Metadata</h3>
                                            </div>
                                            <div className="divide-y divide-zinc-100">
                                                <div className="p-4 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                                    <span className="text-sm text-zinc-500">Created At</span>
                                                    <span className="text-sm font-mono text-zinc-900">{new Date(request.createdAt).toLocaleString()}</span>
                                                </div>
                                                <div className="p-4 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                                    <span className="text-sm text-zinc-500">Last Updated</span>
                                                    <span className="text-sm font-mono text-zinc-900">{new Date(request.updatedAt).toLocaleString()}</span>
                                                </div>
                                                <div className="p-4 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                                    <span className="text-sm text-zinc-500">Resident</span>
                                                    <span className="text-sm font-mono text-zinc-900">
                                                        {residentName}
                                                    </span>
                                                </div>
                                                <div className="p-4 flex justify-between items-center hover:bg-zinc-50 transition-colors">
                                                    <span className="text-sm text-zinc-500">Global Request ID</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-mono text-zinc-400 select-all">{request.id}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                ) : (
                    <div className="flex h-full items-center justify-center flex-col gap-4 text-zinc-500">
                        <AlertCircle className="h-10 w-10 opacity-20" />
                        <p>Request not found.</p>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
