"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Building2, CheckCircle2, MessageCircle, Search, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
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
    useAddOwnerRequestComment,
    useApproveOwnerRequest,
    useOwnerPortfolioRequest,
    useOwnerPortfolioRequests,
    useOwnerRequestCommentUnreadCount,
    useOwnerRequestComments,
    useRejectOwnerRequest,
} from "@/lib/queries";
import { getPathWithoutSearchParams } from "@/lib/searchParams";
import type { RequestStatus, ServiceRequest } from "@/lib/types";
import { priorityStyles, statusLabels, statusStyles } from "@/components/requests/requestDisplay";

const EMPTY_REQUESTS: ServiceRequest[] = [];

const statusTabs: Array<{ label: string; value: RequestStatus | "all" }> = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
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

const formatDate = (value?: string | null, withTime = false) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return withTime
        ? parsed.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : parsed.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function OwnerRequestsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { baseRole } = useAuth();
    const enabled = baseRole === "owner";
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
    const [tenancyFilter, setTenancyFilter] = useState<TenancyFilterValue>("CURRENT");
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const requestedNotificationRequestId = searchParams.get("requestId")?.trim() ?? "";
    const [approvalReason, setApprovalReason] = useState("");
    const [commentDraft, setCommentDraft] = useState("");

    const deferredSearch = useDeferredValue(search);
    const requestsQuery = useOwnerPortfolioRequests({ enabled });
    const unreadCountQuery = useOwnerRequestCommentUnreadCount({ enabled });
    const selectedRequestQuery = useOwnerPortfolioRequest(selectedRequestId, {
        enabled: enabled && Boolean(selectedRequestId),
    });
    const commentsQuery = useOwnerRequestComments(selectedRequestId, {
        enabled: enabled && Boolean(selectedRequestId),
    });
    const approveRequest = useApproveOwnerRequest();
    const rejectRequest = useRejectOwnerRequest();
    const addComment = useAddOwnerRequestComment();

    const requests = requestsQuery.data ?? EMPTY_REQUESTS;
    const filteredRequests = useMemo(() => {
        const term = deferredSearch.trim().toLowerCase();
        return requests
            .filter((entry) => statusFilter === "all" || entry.status === statusFilter)
            .filter((entry) => matchesTenancyFilter(entry, tenancyFilter))
            .filter((entry) => {
                if (!term) return true;
                return [
                    entry.title,
                    entry.description,
                    entry.orgName,
                    entry.buildingName,
                    entry.unit?.label,
                    entry.createdBy?.name,
                    entry.createdBy?.email,
                ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term));
            })
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }, [deferredSearch, requests, statusFilter, tenancyFilter]);

    useEffect(() => {
        if (requestedNotificationRequestId) {
            const requestedEntry = requests.find((entry) => entry.id === requestedNotificationRequestId);
            if (requestedEntry) {
                if (selectedRequestId !== requestedEntry.id) {
                    setSelectedRequestId(requestedEntry.id);
                }
                router.replace(getPathWithoutSearchParams(pathname, searchParams, ["requestId"]), { scroll: false });
                return;
            }
        }
        if (filteredRequests.length === 0) {
            setSelectedRequestId(null);
            return;
        }
        if (!selectedRequestId || !filteredRequests.some((entry) => entry.id === selectedRequestId)) {
            setSelectedRequestId(filteredRequests[0].id);
        }
    }, [filteredRequests, pathname, requestedNotificationRequestId, requests, router, searchParams, selectedRequestId]);

    const request = selectedRequestQuery.data ?? filteredRequests.find((entry) => entry.id === selectedRequestId) ?? null;
    const comments = commentsQuery.data ?? request?.comments ?? [];
    const approvalStatus = String(request?.ownerApproval?.status ?? "").toUpperCase();
    const canApprove = approvalStatus === "PENDING";
    const isApprovalNotRequired = approvalStatus === "NOT_REQUIRED";
    const approvalEstimatedAmount = request?.ownerApproval?.estimatedAmount?.trim();
    const approvalEstimatedCurrency = request?.ownerApproval?.estimatedCurrency?.trim() || "AED";
    const approvalEstimateSummary = approvalEstimatedAmount ? `${approvalEstimatedAmount} ${approvalEstimatedCurrency}` : null;
    const requesterStatusBadge = getRequesterStatusBadgeLabel(request?.requesterContext);
    const requesterContextNotes = getRequesterContextNotes(request);
    const requesterCurrentOccupantLabel = getRequesterCurrentOccupantLabel(request);
    const tenancyCycleBadge = getRequestTenancyBadgeLabel(request?.requestTenancyContext);
    const leaseCycleBadge = getRequestLeaseBadgeLabel(request?.requestTenancyContext);
    const tenancyCycleSourceText = getRequestTenancySourceText(request?.requestTenancyContext);
    const leaseCycleSourceText = getRequestLeaseSourceText(request?.requestTenancyContext);

    const handleApprove = async () => {
        if (!request?.id || !canApprove) return;
        try {
            await approveRequest.mutateAsync({
                requestId: request.id,
                approvalReason: approvalReason.trim() || undefined,
            });
            toast.success("Request approved");
            setApprovalReason("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to approve request");
        }
    };

    const handleReject = async () => {
        if (!request?.id || !canApprove) return;
        const reason = approvalReason.trim();
        if (!reason) {
            toast.error("A rejection reason is required.");
            return;
        }
        try {
            await rejectRequest.mutateAsync({
                requestId: request.id,
                approvalReason: reason,
            });
            toast.success("Request rejected");
            setApprovalReason("");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to reject request");
        }
    };

    const handleCommentSubmit = async () => {
        if (!request?.id || !commentDraft.trim()) return;
        try {
            await addComment.mutateAsync({
                requestId: request.id,
                message: commentDraft.trim(),
            });
            setCommentDraft("");
            toast.success("Comment posted");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to post comment");
        }
    };

    if (baseRole !== "owner") {
        return <div className="rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-500">This portal surface is limited to owner users.</div>;
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-zinc-200 bg-white p-6">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Owner requests</h1>
                <p className="mt-2 text-sm text-zinc-500">
                    Portfolio requests keep both org and building context visible. Opening the comment thread loads the owner-safe comments endpoint and clears the visible unread state on the backend.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><Building2 className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{requests.length}</div><p className="text-xs text-zinc-500">Visible requests</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><AlertCircle className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{requests.filter((entry) => String(entry.ownerApproval?.status ?? "").toUpperCase() === "PENDING").length}</div><p className="text-xs text-zinc-500">Pending approval</p></div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><MessageCircle className="h-5 w-5 text-zinc-600" /><div className="mt-3 text-2xl font-semibold">{unreadCountQuery.data ?? 0}</div><p className="text-xs text-zinc-500">Unread comments</p></div>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="rounded-[28px] border border-zinc-200 bg-white p-5">
                    <div className="relative">
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
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">Loading owner requests...</div>
                        ) : filteredRequests.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-12 text-center text-sm text-zinc-500">No owner requests match the current filter.</div>
                        ) : filteredRequests.map((entry) => (
                            <button
                                key={entry.id}
                                type="button"
                                onClick={() => setSelectedRequestId(entry.id)}
                                className={`w-full rounded-2xl border p-4 text-left ${entry.id === selectedRequestId ? "border-zinc-900 bg-zinc-950 text-white" : "border-zinc-200 bg-white"}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Badge className={entry.id === selectedRequestId ? "bg-white/10 text-white" : statusStyles[entry.status]}>{statusLabels[entry.status]}</Badge>
                                    <Badge className={entry.id === selectedRequestId ? "bg-white/10 text-white" : priorityStyles[entry.priority]}>{entry.priority}</Badge>
                                </div>
                                <h3 className="mt-3 font-semibold">{entry.title}</h3>
                                <p className={`mt-2 text-sm ${entry.id === selectedRequestId ? "text-zinc-200" : "text-zinc-500"}`}>{entry.orgName ?? entry.orgId ?? "Unknown org"} · {entry.buildingName ?? entry.buildingId}</p>
                                <p className={`mt-1 text-xs ${entry.id === selectedRequestId ? "text-zinc-300" : "text-zinc-400"}`}>{entry.unit?.label ?? "No unit"} · {formatDate(entry.updatedAt)}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-[28px] border border-zinc-200 bg-white p-6">
                    {!request ? (
                        <div className="flex min-h-[28rem] items-center justify-center text-sm text-zinc-500">Select a request.</div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={statusStyles[request.status]}>{statusLabels[request.status]}</Badge>
                                    <Badge className={priorityStyles[request.priority]}>{request.priority}</Badge>
                                    {requesterStatusBadge ? <Badge className="bg-violet-100 text-violet-800">{requesterStatusBadge}</Badge> : null}
                                    {request.ownerApproval?.status ? <Badge className="bg-blue-50 text-blue-700">Approval {request.ownerApproval.status}</Badge> : null}
                                </div>
                                <h2 className="mt-4 text-2xl font-semibold text-zinc-950">{request.title}</h2>
                                <p className="mt-2 text-sm text-zinc-500">{request.orgName ?? request.orgId ?? "Unknown org"} · {request.buildingName ?? request.buildingId} · {request.unit?.label ?? "No unit"}</p>
                                <p className="mt-1 text-xs text-zinc-400">Updated {formatDate(request.updatedAt, true)}</p>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                <h3 className="text-sm font-semibold text-zinc-950">Request detail</h3>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-600">{request.description}</p>
                                <div className="mt-4 grid gap-3 text-sm text-zinc-600 md:grid-cols-3">
                                    <div>Reported by: {request.createdBy?.name ?? request.createdBy?.fullName ?? request.createdBy?.email ?? "Unknown"}</div>
                                    <div>Assigned to: {request.assignedTo?.fullName ?? request.assignedTo?.email ?? "Unassigned"}</div>
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
                                {request.attachments && request.attachments.length > 0 ? (
                                    <div className="mt-4 space-y-2">
                                        {request.attachments.map((attachment) => (
                                            <a key={attachment.id} href={attachment.fileUrl} target="_blank" className="block rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                                                {attachment.fileName}
                                            </a>
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
                                        {isApprovalNotRequired ? (
                                            <>
                                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><CheckCircle2 className="h-4 w-4" />Maintenance notice</div>
                                                <p className="mt-2 text-sm text-zinc-500">
                                                    This request was shared for visibility only. Owner approval is not required for the current maintenance path.
                                                </p>
                                            </>
                                        ) : canApprove ? (
                                            <>
                                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><CheckCircle2 className="h-4 w-4" />Approval decision</div>
                                                <p className="mt-2 text-sm text-zinc-500">
                                                    Pending approvals can be approved with an optional note or rejected with a required reason.
                                                </p>
                                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Estimated amount</div>
                                                    <div className="mt-1 text-2xl font-semibold text-amber-950">{approvalEstimateSummary ?? "Not provided"}</div>
                                                    {!approvalEstimateSummary ? (
                                                        <p className="mt-1 text-xs leading-5 text-amber-800">
                                                            The backend did not include an estimate amount with this approval request.
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <Textarea value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Add approval or rejection reason" className="mt-4 min-h-[120px]" />
                                                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                                    <Button onClick={handleApprove} disabled={approveRequest.isPending || rejectRequest.isPending}>
                                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                                        Approve
                                                    </Button>
                                                    <Button variant="outline" onClick={handleReject} disabled={approveRequest.isPending || rejectRequest.isPending}>
                                                        <XCircle className="mr-2 h-4 w-4" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950"><CheckCircle2 className="h-4 w-4" />Approval status</div>
                                                <p className="mt-2 text-sm text-zinc-500">
                                                    {request.ownerApproval?.status ? `Current status: ${request.ownerApproval.status}.` : "No owner approval action is available for this request."}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-zinc-200 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-zinc-950">Owner comments</h3>
                                            <p className="text-sm text-zinc-500">Only owner-visible comments are returned from the backend.</p>
                                        </div>
                                        {commentsQuery.isFetching ? <Badge className="bg-zinc-100 text-zinc-700">Refreshing</Badge> : null}
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        {comments.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500">No comments yet.</div>
                                        ) : comments.map((comment) => (
                                            <div key={comment.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                                                    <span>{comment.user?.fullName ?? comment.user?.email ?? "Unknown author"}</span>
                                                    <span>{formatDate(comment.createdAt, true)}</span>
                                                </div>
                                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{comment.commentText}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 space-y-3">
                                        <Textarea value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Reply to the management thread" className="min-h-[110px]" />
                                        <Button onClick={handleCommentSubmit} disabled={addComment.isPending || !commentDraft.trim()}>
                                            <Send className="mr-2 h-4 w-4" />
                                            Post comment
                                        </Button>
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
