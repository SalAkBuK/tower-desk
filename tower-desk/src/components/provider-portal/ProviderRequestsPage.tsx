"use client";

import { type ChangeEvent, useDeferredValue, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, ClipboardList, MessageCircle, Paperclip, Search, Send, UserRoundCog, Wrench } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getRequesterContextNotes, getRequesterCurrentOccupantLabel, getRequesterStatusBadgeLabel } from "@/lib/requesterContext";
import {
    getRequestLeaseBadgeLabel,
    getRequestLeaseSourceText,
    getRequestTenancyBadgeLabel,
    getRequestTenancySourceText,
    isCurrentRequestTenancyContext,
    isHistoricalRequestTenancyContext,
    isLegacyRequestTenancyContext,
} from "@/lib/requestTenancyContext";
import {
    useAddProviderRequestAttachments,
    useAddProviderRequestComment,
    useAssignProviderRequestWorker,
    useProviderStaff,
    useProviderRequest,
    useProviderRequestComments,
    useProviderRequestUnreadCount,
    useProviderRequests,
    useProviderRuntimeContext,
    useUpdateProviderRequestStatus,
} from "@/lib/queries";
import type { RequestStatus, ServiceProviderMembership, ServiceRequest } from "@/lib/types";
import { priorityStyles, statusLabels, statusStyles } from "@/components/requests/requestDisplay";

const EMPTY_REQUESTS: ServiceRequest[] = [];

const formatDate = (value?: string | null, withTime = false) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return withTime
        ? parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
};

const statusTabs: Array<{ label: string; value: RequestStatus | "all" }> = [
    { label: "All", value: "all" },
    { label: "Open", value: "pending" },
    { label: "Assigned", value: "assigned" },
    { label: "In Progress", value: "in-progress" },
    { label: "Completed", value: "completed" },
];

type TenancyFilterValue = "CURRENT" | "HISTORICAL" | "LEGACY" | "ALL";

const tenancyFilterLabels: Record<TenancyFilterValue, string> = {
    CURRENT: "Current Cycle",
    HISTORICAL: "Historical",
    LEGACY: "Legacy Context",
    ALL: "All Cycles",
};

const matchesTenancyFilter = (request: ServiceRequest, filter: TenancyFilterValue) => {
    if (filter === "ALL") return true;
    if (filter === "CURRENT") return isCurrentRequestTenancyContext(request.requestTenancyContext);
    if (filter === "HISTORICAL") return isHistoricalRequestTenancyContext(request.requestTenancyContext);
    return isLegacyRequestTenancyContext(request.requestTenancyContext);
};

const getWorkerOptions = (request?: ServiceRequest | null) =>
    (request?.availableWorkers ?? []).filter((entry) => String(entry.role ?? "").toUpperCase() === "WORKER" || !entry.role);

const getActiveWorkerOptions = (workers?: ServiceProviderMembership[] | null) =>
    (workers ?? []).filter((entry) =>
        (String(entry.role ?? "").toUpperCase() === "WORKER" || !entry.role)
        && entry.membershipIsActive !== false
        && entry.userIsActive !== false
    );

export function ProviderRequestsPage() {
    const { baseRole } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
    const [tenancyFilter, setTenancyFilter] = useState<TenancyFilterValue>("CURRENT");
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [selectedWorkerId, setSelectedWorkerId] = useState("");
    const [commentDraft, setCommentDraft] = useState("");

    const deferredSearch = useDeferredValue(search);
    const providerContextQuery = useProviderRuntimeContext({ enabled: baseRole === "service_provider" });
    const providerAccess = providerContextQuery.data?.providers ?? [];
    const singleProvider = providerAccess.length === 1 ? providerAccess[0] : null;
    const multiProvider = providerAccess.length > 1;

    useEffect(() => {
        if (!multiProvider) {
            setSelectedProviderId("");
            return;
        }
        if (!providerAccess.some((entry) => entry.providerId === selectedProviderId)) {
            setSelectedProviderId(providerAccess[0]?.providerId ?? "");
        }
    }, [multiProvider, providerAccess, selectedProviderId]);

    const providerFilter = multiProvider ? selectedProviderId || undefined : singleProvider?.providerId;
    const requestsQuery = useProviderRequests({
        enabled: baseRole === "service_provider" && (Boolean(singleProvider) || Boolean(providerFilter)),
        serviceProviderId: providerFilter,
    });
    const unreadCountQuery = useProviderRequestUnreadCount({
        enabled: baseRole === "service_provider" && Boolean(singleProvider),
    });
    const providerStaffQuery = useProviderStaff({
        enabled: baseRole === "service_provider" && Boolean(singleProvider),
    });
    const selectedRequestQuery = useProviderRequest(selectedRequestId, {
        enabled: baseRole === "service_provider" && Boolean(selectedRequestId) && Boolean(singleProvider),
    });
    const commentsQuery = useProviderRequestComments(selectedRequestId, {
        enabled: baseRole === "service_provider" && Boolean(selectedRequestId) && Boolean(singleProvider),
    });
    const assignWorker = useAssignProviderRequestWorker();
    const updateStatus = useUpdateProviderRequestStatus();
    const addComment = useAddProviderRequestComment();
    const addAttachments = useAddProviderRequestAttachments();

    const requests = requestsQuery.data ?? EMPTY_REQUESTS;
    const filteredRequests = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();
        return requests
            .filter((entry) => statusFilter === "all" || entry.status === statusFilter)
            .filter((entry) => matchesTenancyFilter(entry, tenancyFilter))
            .filter((entry) => {
                if (!term) return true;
                return [entry.title, entry.description, entry.buildingName, entry.unit?.label]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term));
            })
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [deferredSearch, requests, statusFilter, tenancyFilter]);

    useEffect(() => {
        if (!singleProvider) {
            setSelectedRequestId(null);
            return;
        }
        if (filteredRequests.length === 0) {
            setSelectedRequestId(null);
            return;
        }
        if (!selectedRequestId || !filteredRequests.some((entry) => entry.id === selectedRequestId)) {
            setSelectedRequestId(filteredRequests[0].id);
        }
    }, [filteredRequests, selectedRequestId, singleProvider]);

    const request = singleProvider
        ? selectedRequestQuery.data ?? filteredRequests.find((entry) => entry.id === selectedRequestId) ?? null
        : null;
    const comments = commentsQuery.data ?? request?.comments ?? [];
    const workerOptions = getWorkerOptions(request);
    const fallbackWorkerOptions = getActiveWorkerOptions(providerStaffQuery.data ?? []);
    const assignableWorkers = workerOptions.length > 0 ? workerOptions : fallbackWorkerOptions;
    const currentUserId = providerContextQuery.data?.userId ?? "";
    const isAdmin = String(singleProvider?.role ?? "").toUpperCase() === "ADMIN";
    const canMutate = Boolean(request) && (isAdmin || request?.serviceProviderAssignedTo?.id === currentUserId);
    const approvalStatus = String(request?.ownerApproval?.status ?? "").toUpperCase();
    const actionsBlocked = approvalStatus === "PENDING" || approvalStatus === "REJECTED";
    const requesterStatusBadge = getRequesterStatusBadgeLabel(request?.requesterContext);
    const requesterContextNotes = getRequesterContextNotes(request);
    const requesterCurrentOccupantLabel = getRequesterCurrentOccupantLabel(request);
    const tenancyCycleBadge = getRequestTenancyBadgeLabel(request?.requestTenancyContext);
    const leaseCycleBadge = getRequestLeaseBadgeLabel(request?.requestTenancyContext);
    const tenancyCycleSourceText = getRequestTenancySourceText(request?.requestTenancyContext);
    const leaseCycleSourceText = getRequestLeaseSourceText(request?.requestTenancyContext);

    useEffect(() => {
        setSelectedWorkerId(request?.serviceProviderAssignedTo?.id ?? "");
    }, [request?.serviceProviderAssignedTo?.id]);

    useEffect(() => {
        if (!singleProvider || !selectedRequestId || !commentsQuery.data) return;
        queryClient.invalidateQueries({ queryKey: ["provider-request-unread-count"] });
    }, [commentsQuery.data, queryClient, selectedRequestId, singleProvider]);

    const handleAssignWorker = async () => {
        if (!selectedRequestId || !isAdmin || actionsBlocked) return;
        const userId = selectedWorkerId;
        if (!userId) return toast.error("Select a worker first.");
        try {
            await assignWorker.mutateAsync({ requestId: selectedRequestId, userId });
            toast.success("Worker assigned");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to assign worker");
        }
    };

    const handleStatusUpdate = async (status: Extract<RequestStatus, "in-progress" | "completed">) => {
        if (!selectedRequestId || !canMutate || actionsBlocked) return;
        try {
            await updateStatus.mutateAsync({ requestId: selectedRequestId, status });
            toast.success(status === "completed" ? "Request marked completed" : "Request moved to in progress");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update request status");
        }
    };

    const handleCommentSubmit = async () => {
        if (!selectedRequestId || !canMutate || actionsBlocked || !commentDraft.trim()) return;
        try {
            await addComment.mutateAsync({ requestId: selectedRequestId, message: commentDraft.trim() });
            setCommentDraft("");
            toast.success("Comment posted");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to post comment");
        }
    };

    const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!selectedRequestId || !canMutate || actionsBlocked || files.length === 0) return;
        try {
            const attachments = await Promise.all(files.map(async (file) => {
                const upload = await uploadToCloudinary(file, file.type.startsWith("image/") ? "image" : "raw");
                return { fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, url: upload.url };
            }));
            await addAttachments.mutateAsync({ requestId: selectedRequestId, attachments });
            toast.success(files.length === 1 ? "Attachment uploaded" : "Attachments uploaded");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload attachment");
        } finally {
            event.target.value = "";
        }
    };

    if (baseRole !== "service_provider") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to provider managers.</div>;
    }
    if (providerContextQuery.isLoading && !providerContextQuery.data) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">Loading provider access...</div>;
    }
    if (providerAccess.length === 0) {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">No provider access. `GET /provider/me` returned no active provider memberships.</div>;
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Request Queue</h1>
                <p className="mt-2 text-sm text-zinc-500">
                    {singleProvider
                        ? `Review jobs for ${singleProvider.name}.`
                        : "Filter the queue by provider. Detail and write routes remain blocked for multi-provider access."}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><ClipboardList className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{requests.filter((entry) => entry.status === "pending" || entry.status === "assigned").length}</div><p className="text-xs text-zinc-500">Open Queue</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><Wrench className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{requests.filter((entry) => entry.status === "in-progress").length}</div><p className="text-xs text-zinc-500">In Progress</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><MessageCircle className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{singleProvider ? unreadCountQuery.data ?? 0 : "N/A"}</div><p className="text-xs text-zinc-500">Unread Comments</p></div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                    {multiProvider ? (
                        <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                            <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                            <SelectContent>{providerAccess.map((entry) => <SelectItem key={entry.providerId} value={entry.providerId}>{entry.name}</SelectItem>)}</SelectContent>
                        </Select>
                    ) : null}
                    <div className="relative mt-4">
                        <div className="grid gap-3">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" className="pl-9" />
                            </div>
                            <div className="space-y-2">
                                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">Tenancy Context</div>
                                <Select value={tenancyFilter} onValueChange={(value) => setTenancyFilter(value as TenancyFilterValue)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={tenancyFilterLabels[tenancyFilter]} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(tenancyFilterLabels).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {statusTabs.map((tab) => (
                            <button key={tab.value} type="button" onClick={() => setStatusFilter(tab.value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusFilter === tab.value ? "bg-zinc-950 text-white" : "bg-zinc-100 text-zinc-600"}`}>{tab.label}</button>
                        ))}
                    </div>
                    <div className="mt-4 space-y-3">
                        {(requestsQuery.isLoading && requests.length === 0) ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">Loading provider requests...</div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">No provider requests match the current filter.</div>
                        ) : filteredRequests.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => singleProvider && setSelectedRequestId(entry.id)}
                                className={`w-full rounded-2xl border p-4 text-left ${entry.id === selectedRequestId ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Badge className={entry.id === selectedRequestId ? "bg-white/10 text-white" : statusStyles[entry.status]}>{statusLabels[entry.status]}</Badge>
                                    <Badge className={entry.id === selectedRequestId ? "bg-white/10 text-white" : priorityStyles[entry.priority]}>{entry.priority}</Badge>
                                </div>
                                <h3 className="mt-3 font-semibold">{entry.title}</h3>
                                <p className={`mt-2 text-sm ${entry.id === selectedRequestId ? "text-zinc-200" : "text-zinc-500"}`}>{entry.buildingName ?? entry.buildingId} · {entry.unit?.label ?? "No unit"}</p>
                                <p className={`mt-2 text-xs ${entry.id === selectedRequestId ? "text-zinc-300" : "text-zinc-400"}`}>{formatDate(entry.updatedAt)}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    {multiProvider ? (
                        <div className="flex min-h-[28rem] items-center justify-center text-center">
                            <div>
                                <AlertCircle className="mx-auto h-10 w-10 text-zinc-300" />
                                <h2 className="mt-4 text-lg font-semibold text-zinc-950">Multi-provider access is blocked here</h2>
                                <p className="mt-2 max-w-md text-sm text-zinc-500">The queue works with a provider filter, but request detail and write routes still assume a single active provider context.</p>
                            </div>
                        </div>
                    ) : !request ? (
                        <div className="flex min-h-[28rem] items-center justify-center text-sm text-zinc-500">Select a request.</div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={statusStyles[request.status]}>{statusLabels[request.status]}</Badge>
                                    <Badge className={priorityStyles[request.priority]}>{request.priority}</Badge>
                                    {requesterStatusBadge ? <Badge className="bg-violet-100 text-violet-800">{requesterStatusBadge}</Badge> : null}
                                    {request.type ? <Badge className="bg-zinc-100 text-zinc-700">{request.type}</Badge> : null}
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold text-zinc-950">{request.title}</h2>
                                <p className="mt-2 text-sm text-zinc-500">{request.buildingName ?? request.buildingId} · {request.unit?.label ?? "No unit"} · Updated {formatDate(request.updatedAt, true)}</p>
                            </div>

                            {actionsBlocked ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Owner approval is {approvalStatus.toLowerCase()}. Provider-side actions should stay blocked.</div>
                            ) : null}

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <h3 className="text-sm font-semibold text-zinc-950">Request detail</h3>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{request.description}</p>
                                <div className="mt-4 grid gap-3 text-sm text-zinc-600 md:grid-cols-3">
                                    <div>Reported by: {request.createdBy?.name ?? request.createdBy?.fullName ?? request.createdBy?.email ?? "Unknown"}</div>
                                    <div>Assigned worker: {request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email ?? "Unassigned"}</div>
                                    <div>Created: {formatDate(request.createdAt, true)}</div>
                                </div>
                                {requesterCurrentOccupantLabel ? (
                                    <div className="mt-4 text-sm text-zinc-600">Current occupant: {requesterCurrentOccupantLabel}</div>
                                ) : null}
                                {requesterContextNotes.length > 0 ? (
                                    <div className="mt-4 space-y-2">
                                        {requesterContextNotes.map((note) => (
                                            <div key={note} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                {note}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4">
                                <h3 className="text-sm font-semibold text-zinc-950">Tenancy cycle</h3>
                                <div className="mt-3 grid gap-3 text-sm text-zinc-600 md:grid-cols-2">
                                    <div>
                                        <div>Occupancy cycle: {tenancyCycleBadge}</div>
                                        {tenancyCycleSourceText ? <div className="mt-1 text-xs text-sky-900/70">{tenancyCycleSourceText}</div> : null}
                                    </div>
                                    <div>
                                        <div>Lease cycle: {leaseCycleBadge}</div>
                                        {leaseCycleSourceText ? <div className="mt-1 text-xs text-sky-900/70">{leaseCycleSourceText}</div> : null}
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="space-y-6">
                                    <div className="rounded-2xl border border-zinc-200 p-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><UserRoundCog className="h-4 w-4" />Worker assignment</div>
                                        <p className="mt-2 text-sm text-zinc-500">{isAdmin ? "Provider admins can assign workers." : "Only provider admins can assign workers."}</p>
                                        <div className="mt-4 space-y-3">
                                            {assignableWorkers.length > 0 ? (
                                                <Select value={selectedWorkerId || "__none__"} onValueChange={(value) => setSelectedWorkerId(value === "__none__" ? "" : value)}>
                                                    <SelectTrigger><SelectValue placeholder="Select provider worker" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none__">Select provider worker</SelectItem>
                                                        {assignableWorkers.map((worker: ServiceProviderMembership) => <SelectItem key={worker.userId} value={worker.userId}>{worker.name ?? worker.email ?? worker.userId}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-4 text-sm text-zinc-500">
                                                    No active provider workers are available for assignment.
                                                </div>
                                            )}
                                            <Button onClick={handleAssignWorker} disabled={assignWorker.isPending || !isAdmin || actionsBlocked || !selectedWorkerId} className="w-full">Assign worker</Button>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 p-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><Wrench className="h-4 w-4" />Status actions</div>
                                        <p className="mt-2 text-sm text-zinc-500">{canMutate ? "You can update this request from the provider portal." : "This request is not currently mutable from your provider account."}</p>
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <Button variant="outline" onClick={() => handleStatusUpdate("in-progress")} disabled={updateStatus.isPending || !canMutate || actionsBlocked || request.status === "in-progress" || request.status === "completed"}><AlertCircle className="mr-2 h-4 w-4" />Start work</Button>
                                            <Button onClick={() => handleStatusUpdate("completed")} disabled={updateStatus.isPending || !canMutate || actionsBlocked || request.status === "completed"}><CheckCircle2 className="mr-2 h-4 w-4" />Mark completed</Button>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-zinc-200 p-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><Paperclip className="h-4 w-4" />Attachments</div>
                                        <label className={`mt-4 flex items-center justify-center rounded-2xl border border-dashed px-4 py-4 text-sm ${canMutate && !actionsBlocked ? "cursor-pointer border-zinc-300 text-zinc-600" : "cursor-not-allowed border-zinc-200 text-zinc-400"}`}>
                                            <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} disabled={!canMutate || actionsBlocked} />
                                            Upload attachments
                                        </label>
                                        <div className="mt-4 space-y-2">
                                            {(request.attachments ?? []).length === 0 ? <div className="text-sm text-zinc-500">No attachments uploaded yet.</div> : request.attachments?.map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" className="block rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700">{attachment.fileName}</a>)}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 p-4">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><MessageCircle className="h-4 w-4" />Shared comments</div>
                                    <div className="mt-4 space-y-3">
                                        {comments.length === 0 ? <div className="text-sm text-zinc-500">No shared comments yet.</div> : comments.map((comment) => (
                                            <div key={comment.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="text-sm font-semibold text-zinc-950">{comment.user?.fullName ?? comment.user?.email ?? "Provider user"}</div>
                                                    <div className="text-xs text-zinc-400">{formatDate(comment.createdAt, true)}</div>
                                                </div>
                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{comment.commentText}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
                                        <Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder={canMutate && !actionsBlocked ? "Post a shared update for the building team" : "You can't post a shared comment on this request right now"} className="min-h-28" disabled={!canMutate || actionsBlocked} />
                                        <Button onClick={handleCommentSubmit} disabled={addComment.isPending || !canMutate || actionsBlocked || !commentDraft.trim()} className="w-full"><Send className="mr-2 h-4 w-4" />Post shared comment</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
