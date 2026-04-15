"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleAlert, FileText, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
    estimateStatusLabels,
    estimateStatusStyles,
    ownerApprovalStatusLabels,
    ownerApprovalStatusStyles,
    policyRouteLabels,
    recommendationLabels,
    recommendationStyles,
    requestQueueLabels,
    statusLabels,
} from "@/components/requests/requestDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { getUserPermissionSet, hasPermissionPrefix } from "@/lib/permissions";
import {
    getManagementRequesterContextNotes,
    getManagementRequesterInviteLabel,
    getManagementRequesterOccupancyLabel,
    getManagementRequesterStatusLabel,
    getRequesterStatusBadgeLabel,
} from "@/lib/requesterContext";
import {
    getManagementRequestLeaseSourceText,
    getManagementRequestTenancySourceText,
    getRequestLeaseRowBadgeLabel,
    getRequestTenancyRowBadgeLabel,
    isCurrentRequestTenancyContext,
} from "@/lib/requestTenancyContext";
import {
    useAddRequestAttachments,
    useAddRequestComment,
    useAdminUsers,
    useAssignRequest,
    useAssignRequestProvider,
    useCancelRequest,
    useRequest,
    useRequestEstimate,
    useRequestOwnerApprovalNow,
    useSendOwnerApprovalReminder,
    useServiceProviders,
    useSubmitRequestEstimate,
    useTriageRequestPolicy,
    useUnassignRequestProvider,
    useUpdateRequestStatus,
    useUsers,
    useOverrideOwnerApproval,
} from "@/lib/queries";
import { canAssignRequests, canCommentOnRequests, canUpdateRequestStatuses } from "@/lib/requestPermissions";
import { isBuildingScopedManagementRole } from "@/lib/roles";
import type { RequestCommentVisibility, RequestPolicyRoute, RequestQueue, ServiceRequest } from "@/lib/types";

interface RequestDetailSheetProps {
    requestId: string | null;
    buildingId?: string | null;
    buildingNameById?: Record<string, string>;
    onClose: () => void;
}

type SectionKey = "assignment" | "workflow" | "attachments" | "advanced";
type ActionDefinition = { key: string; label: string; onClick: () => void | Promise<unknown>; disabled?: boolean };
type AssignmentTarget = "staff" | "provider";
type ProgressReviewSubmissionResult =
    | { status: "noop" }
    | { status: "blocked" | "failed" | "posted"; message: string };
export type RequestDetailEstimateActionMode = "none" | "request" | "submit" | "workflow-submit";

const MANAGEMENT_ROLES = new Set(["superadmin", "admin", "org_admin", "building_admin", "manager"]);
const STITCH_SURFACE = "bg-[#fbf8ff]";
const STITCH_PANEL = "bg-white";
const STITCH_PANEL_SOFT = "bg-[#f3f2ff]";
const STITCH_BORDER = "border-[#aeb0c9]/20";
const STITCH_TEXT = "text-[#2e3145]";
const STITCH_MUTED = "text-[#5b5e74]";

const formatDateTime = (value?: string | null) => {
    if (!value) return "N/A";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const toDateTimeLocalValue = (value?: string | null) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const offset = parsed.getTimezoneOffset();
    const local = new Date(parsed.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 16);
};

const formatBoolean = (value?: boolean | null) => value == null ? "Unknown" : value ? "Yes" : "No";

const getDisplayQueue = (request?: ServiceRequest | null): RequestQueue | null => {
    if (!request) return null;
    if (request.queue && request.queue !== "OVERDUE") return request.queue;
    if ((request.ownerApproval?.status ?? request.ownerApprovalStatus) === "PENDING") return "AWAITING_OWNER";
    if ((request.ownerApproval?.status ?? request.ownerApprovalStatus) === "REJECTED") return "AWAITING_OWNER";
    if (request.estimate?.status === "REQUESTED") return "AWAITING_ESTIMATE";
    if (request.status === "in-progress") return "IN_PROGRESS";
    if (request.status === "assigned" || request.assignedEmployeeId || request.serviceProvider || request.serviceProviderAssignedTo) return "ASSIGNED";
    return "READY_TO_ASSIGN";
};

const DisclosureSection = ({
    title,
    summary,
    detailsRef,
    children,
    tone = "default",
    defaultOpen = false,
}: {
    title: string;
    summary: string;
    detailsRef?: (node: HTMLDetailsElement | null) => void;
    children: ReactNode;
    tone?: "default" | "advanced";
    defaultOpen?: boolean;
}) => (
    <details
        ref={detailsRef}
        open={defaultOpen}
        className={[
            "group overflow-hidden rounded-xl border border-[#aeb0c9]/15 transition-colors",
            tone === "advanced"
                ? "bg-white shadow-[0px_12px_30px_-18px_rgba(46,49,69,0.12)]"
                : "bg-white shadow-[0px_12px_30px_-18px_rgba(46,49,69,0.08)]",
        ].join(" ")}
    >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 marker:hidden hover:bg-zinc-50/70">
            <div className="min-w-0">
                <div className="text-sm font-bold uppercase tracking-[0.16em] text-[#2e3145]">{title}</div>
                <div className="mt-1 truncate text-xs text-[#5b5e74]">{summary}</div>
            </div>
            <div className="flex items-center gap-3 text-[#5b5e74]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f2ff] transition-transform group-open:rotate-180">
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>
        </summary>
        <div className="px-4 pb-4">
            <div className="space-y-5">{children}</div>
        </div>
    </details>
);

const Banner = ({
    title,
    body,
    tone = "neutral",
}: {
    title: string;
    body: ReactNode;
    tone?: "danger" | "warning" | "info" | "neutral";
}) => {
    const toneClasses =
        tone === "danger"
            ? "border-rose-200/70 bg-rose-50/90 text-rose-900"
            : tone === "warning"
              ? "border-amber-200/70 bg-amber-50/90 text-amber-900"
              : tone === "info"
                ? "border-blue-200/70 bg-blue-50/90 text-blue-900"
                : "border-[#aeb0c9]/30 bg-[#f3f2ff] text-[#2e3145]";

    return (
        <div className={`rounded-xl border px-4 py-3 ${toneClasses}`}>
            <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                    <div className="text-sm font-semibold">{title}</div>
                    <div className="mt-1 text-sm leading-6">{body}</div>
                </div>
            </div>
        </div>
    );
};

const SubsectionCard = ({
    title,
    description,
    children,
    className = "",
}: {
    title: string;
    description?: string;
    children: ReactNode;
    className?: string;
}) => (
    <div className={`rounded-xl border bg-[#f3f2ff] p-4 ${className}`.trim()}>
        <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold text-[#2e3145]">{title}</div>
            {description ? <div className="text-sm leading-6 text-[#5b5e74]">{description}</div> : null}
        </div>
        <div className="mt-4 space-y-4">{children}</div>
    </div>
);

const getTimeValue = (value?: string | null) => {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
};

const formatFileSize = (sizeBytes?: number | null) => {
    if (!sizeBytes || sizeBytes <= 0) return null;
    if (sizeBytes < 1024) return `${sizeBytes} B`;
    if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`;
    return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
};

export const PROGRESS_REVIEW_DRAFT_CONFLICT_MESSAGE = "You already have a draft comment. Post or clear it before using this action.";

export const getProgressReviewCommentText = (isOverdue: boolean) => (
    isOverdue
        ? "This request is overdue. Please share a progress update immediately."
        : "Please share a progress update."
);

export const submitProgressReviewComment = async ({
    requestId,
    buildingId,
    canComment,
    hasDraft,
    canSeeInternalComments,
    commentVisibility,
    isOverdue,
    submitComment,
}: {
    requestId?: string | null;
    buildingId?: string | null;
    canComment: boolean;
    hasDraft: boolean;
    canSeeInternalComments: boolean;
    commentVisibility: RequestCommentVisibility;
    isOverdue: boolean;
    submitComment: (payload: {
        requestId: string;
        buildingId: string;
        commentText: string;
        visibility: RequestCommentVisibility;
    }) => Promise<unknown>;
}): Promise<ProgressReviewSubmissionResult> => {
    if (!requestId || !buildingId || !canComment) return { status: "noop" };
    if (hasDraft) return { status: "blocked", message: PROGRESS_REVIEW_DRAFT_CONFLICT_MESSAGE };

    try {
        await submitComment({
            requestId,
            buildingId,
            commentText: getProgressReviewCommentText(isOverdue),
            visibility: canSeeInternalComments ? commentVisibility : "SHARED",
        });
        return {
            status: "posted",
            message: isOverdue ? "Escalation comment posted" : "Progress review comment posted",
        };
    } catch (error) {
        return {
            status: "failed",
            message: error instanceof Error ? error.message : "Failed to post progress review comment",
        };
    }
};

export const getRequestDetailEstimateActionMode = ({
    requestQueue,
    policyRoute,
    activeQueue,
    hasDraftEstimateAmount,
    ownerApprovalRejected,
}: {
    requestQueue?: RequestQueue | null;
    policyRoute?: RequestPolicyRoute | null;
    activeQueue?: RequestQueue | null;
    hasDraftEstimateAmount: boolean;
    ownerApprovalRejected: boolean;
}): RequestDetailEstimateActionMode => {
    if (ownerApprovalRejected) return "none";

    const isNeedsEstimateEntryPoint = (requestQueue === "NEW" && policyRoute === "NEEDS_ESTIMATE") || activeQueue === "NEEDS_ESTIMATE";
    if (isNeedsEstimateEntryPoint) {
        return hasDraftEstimateAmount ? "submit" : "request";
    }

    if (activeQueue === "AWAITING_ESTIMATE" && hasDraftEstimateAmount) {
        return "workflow-submit";
    }

    return "none";
};

const SummaryTableRow = ({
    label,
    value,
    borderClass = "border-zinc-200/80",
}: {
    label: string;
    value: ReactNode;
    borderClass?: string;
}) => (
    <div className={`grid grid-cols-[112px_minmax(0,1fr)] items-center gap-4 py-4 ${borderClass}`}>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">{label}</div>
        <div className="min-w-0 text-sm font-semibold text-[#2e3145]">{value}</div>
    </div>
);

export function RequestDetailSheet({ requestId, buildingId, buildingNameById, onClose }: RequestDetailSheetProps) {
    const { user, baseRole, buildingScope } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canAssign = canAssignRequests(permissionSet);
    const canUpdateStatus = canUpdateRequestStatuses(permissionSet);
    const canComment = canCommentOnRequests(permissionSet);
    const canOverrideApproval = hasPermissionPrefix(permissionSet, "requests.owner_approval_override");
    const canSeeInternalComments = MANAGEMENT_ROLES.has(String(baseRole ?? ""));
    const canLoadScopedUsers = canAssign && isBuildingScopedManagementRole(baseRole);

    const { data: request, isLoading } = useRequest(requestId || "", buildingId ?? undefined, { enabled: !!requestId });
    const { data: scopedUsers } = useAdminUsers(canLoadScopedUsers ? buildingScope : [], { enabled: canLoadScopedUsers });
    const { data: allUsers } = useUsers({ enabled: baseRole === "superadmin" && canAssign });
    const { data: serviceProviders } = useServiceProviders({ enabled: canAssign });

    const updateStatus = useUpdateRequestStatus();
    const cancelRequest = useCancelRequest();
    const assignRequest = useAssignRequest();
    const assignProvider = useAssignRequestProvider();
    const unassignProvider = useUnassignRequestProvider();
    const requestEstimate = useRequestEstimate();
    const submitEstimate = useSubmitRequestEstimate();
    const saveTriage = useTriageRequestPolicy();
    const requestApproval = useRequestOwnerApprovalNow();
    const sendReminder = useSendOwnerApprovalReminder();
    const overrideApproval = useOverrideOwnerApproval();
    const addAttachments = useAddRequestAttachments();
    const addComment = useAddRequestComment();

    const adminAttachmentInputRef = useRef<HTMLInputElement | null>(null);
    const sectionRefs = useRef<Partial<Record<SectionKey, HTMLDetailsElement | null>>>({});
    const users = baseRole === "superadmin" ? allUsers : scopedUsers;
    const requestBuildingId = request?.buildingId ?? buildingId ?? "";
    const employees = (users ?? []).filter((entry) => (entry.baseRole ?? entry.role) === "employee" && (!requestBuildingId || entry.buildingIds?.includes(requestBuildingId)));
    const availableProviders = (serviceProviders ?? []).filter((provider) => provider.isActive && provider.linkedBuildings.some((entry) => entry.buildingId === requestBuildingId));

    const [selectedStaffUserId, setSelectedStaffUserId] = useState("");
    const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
    const [assignmentTarget, setAssignmentTarget] = useState<AssignmentTarget>("staff");
    const [estimatedAmount, setEstimatedAmount] = useState("");
    const [estimatedCurrency, setEstimatedCurrency] = useState("AED");
    const [approvalReason, setApprovalReason] = useState("");
    const [ownerApprovalDeadlineAt, setOwnerApprovalDeadlineAt] = useState("");
    const [overrideReason, setOverrideReason] = useState("");
    const [overrideDecisionSource, setOverrideDecisionSource] = useState("EMERGENCY_OVERRIDE");
    const [commentText, setCommentText] = useState("");
    const [commentVisibility, setCommentVisibility] = useState<RequestCommentVisibility>("SHARED");
    const [showAllComments, setShowAllComments] = useState(false);
    const [isReviseEstimateOpen, setIsReviseEstimateOpen] = useState(false);
    const [isEmergency, setIsEmergency] = useState(false);
    const [isLikeForLike, setIsLikeForLike] = useState(false);
    const [isUpgrade, setIsUpgrade] = useState(false);
    const [isMajorReplacement, setIsMajorReplacement] = useState(false);
    const [isResponsibilityDisputed, setIsResponsibilityDisputed] = useState(false);

    const handleSelectAssignmentTarget = (nextTarget: AssignmentTarget) => {
        setAssignmentTarget(nextTarget);
        if (nextTarget === "staff") {
            setSelectedServiceProviderId("");
            return;
        }
        setSelectedStaffUserId("");
    };

    const handleSelectStaffAssignment = (value: string) => {
        const nextStaffUserId = value === "__none__" ? "" : value;
        setAssignmentTarget("staff");
        setSelectedStaffUserId(nextStaffUserId);
        if (nextStaffUserId) {
            setSelectedServiceProviderId("");
        }
    };

    const handleSelectProviderAssignment = (value: string) => {
        const nextProviderId = value === "__none__" ? "" : value;
        setAssignmentTarget("provider");
        setSelectedServiceProviderId(nextProviderId);
        if (nextProviderId) {
            setSelectedStaffUserId("");
        }
    };

    useEffect(() => {
        setSelectedStaffUserId(request?.assignedEmployeeId ?? "");
        setSelectedServiceProviderId(request?.serviceProvider?.id ?? "");
        setAssignmentTarget(request?.serviceProvider?.id ? "provider" : "staff");
        setEstimatedAmount(request?.ownerApproval?.estimatedAmount ?? "");
        setEstimatedCurrency(request?.ownerApproval?.estimatedCurrency ?? "AED");
        setApprovalReason(request?.ownerApproval?.requiredReason ?? request?.policy?.summary ?? "");
        setOwnerApprovalDeadlineAt(toDateTimeLocalValue(request?.ownerApproval?.deadlineAt));
        setShowAllComments(false);
        setIsEmergency(Boolean(request?.policy?.isEmergency ?? request?.isEmergency));
        setIsLikeForLike(Boolean(request?.policy?.isLikeForLike ?? request?.isLikeForLike));
        setIsUpgrade(Boolean(request?.policy?.isUpgrade ?? request?.isUpgrade));
        setIsMajorReplacement(Boolean(request?.policy?.isMajorReplacement ?? request?.isMajorReplacement));
        setIsResponsibilityDisputed(Boolean(request?.policy?.isResponsibilityDisputed ?? request?.isResponsibilityDisputed));
        setIsReviseEstimateOpen(false);
    }, [request]);

    const openSection = (section: SectionKey) => {
        const node = sectionRefs.current[section];
        if (!node) return;
        node.open = true;
        node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    const registerSection = (section: SectionKey) => (node: HTMLDetailsElement | null) => {
        sectionRefs.current[section] = node;
    };

    const activeQueue = getDisplayQueue(request);
    const isOverdue = request?.queue === "OVERDUE";
    const ownerApprovalStatus = request?.ownerApproval?.status ?? request?.ownerApprovalStatus ?? "NOT_REQUIRED";
    const estimateStatus = request?.estimate?.status ?? "NOT_REQUESTED";
    const ownerApprovalPending = ownerApprovalStatus === "PENDING";
    const ownerApprovalRejected = ownerApprovalStatus === "REJECTED";
    const estimateRequested = estimateStatus === "REQUESTED" || activeQueue === "AWAITING_ESTIMATE";
    const visibleComments = [...(request?.comments ?? [])]
        .filter((comment) => canSeeInternalComments || comment.visibility !== "INTERNAL")
        .sort((left, right) => getTimeValue(right.createdAt) - getTimeValue(left.createdAt));
    const attachments = request?.attachments ?? [];
    const attachmentPreviewItems = attachments.slice(0, 3);
    const moreAttachmentCount = Math.max(attachments.length - attachmentPreviewItems.length, 0);
    const collapsedCommentCount = Math.max(visibleComments.length - 2, 0);
    const commentsToRender = showAllComments ? visibleComments : visibleComments.slice(0, 2);
    const buildingName = request ? buildingNameById?.[request.buildingId] ?? request.buildingName ?? request.buildingId : buildingId ?? "";
    const unitLine = request?.unit?.label ?? request?.unit?.id ?? "No unit";
    const unitMeta = typeof request?.unit?.floor === "number" ? `${unitLine} | Floor ${request.unit.floor}` : unitLine;
    const requestedByName = request?.createdBy?.name ?? request?.createdBy?.fullName ?? request?.createdBy?.email ?? request?.createdByTenantId;
    const requesterStatusBadge = getRequesterStatusBadgeLabel(request?.requesterContext);
    const managementRequesterStatus = getManagementRequesterStatusLabel(request?.requesterContext);
    const managementRequesterInvite = getManagementRequesterInviteLabel(request?.requesterContext);
    const managementRequesterOccupancy = getManagementRequesterOccupancyLabel(request);
    const requesterContextNotes = getManagementRequesterContextNotes(request);
    const tenancyCycleBadge = getRequestTenancyRowBadgeLabel(request?.requestTenancyContext);
    const leaseCycleBadge = getRequestLeaseRowBadgeLabel(request?.requestTenancyContext);
    const tenancyCycleSourceText = getManagementRequestTenancySourceText(request?.requestTenancyContext);
    const leaseCycleSourceText = getManagementRequestLeaseSourceText(request?.requestTenancyContext);
    const hasHistoricalRequesterContext = Boolean(
        request?.requesterContext?.isFormerResident
        || request?.requesterContext?.residentOccupancyStatus === "FORMER"
        || request?.requesterContext?.currentUnitOccupiedByRequester === false
    );
    const hasHistoricalTenancyContext = Boolean(
        request?.requestTenancyContext && !isCurrentRequestTenancyContext(request.requestTenancyContext)
    );
    const shouldShowResidentContext = hasHistoricalRequesterContext;
    const shouldShowRequestCycle = hasHistoricalRequesterContext || hasHistoricalTenancyContext;
    const assignedStaffName = request?.assignedTo?.fullName ?? request?.assignedTo?.email ?? "Unassigned";
    const providerName = request?.serviceProvider?.name ?? "";
    const providerWorkerName = request?.serviceProviderAssignedTo?.name ?? request?.serviceProviderAssignedTo?.email ?? "";
    const currentStaffUserId = request?.assignedEmployeeId ?? request?.assignedTo?.id ?? "";
    const currentProviderId = request?.serviceProvider?.id ?? "";
    const selectedStaffEntry = employees.find((employee) => employee.id === selectedStaffUserId);
    const selectedProviderEntry = availableProviders.find((provider) => provider.id === selectedServiceProviderId);
    const selectedStaffName = selectedStaffEntry?.fullName ?? selectedStaffEntry?.name ?? selectedStaffEntry?.email ?? "Selected staff";
    const selectedProviderName = selectedProviderEntry?.name ?? "Selected provider";
    const assignmentSummary = [
        currentStaffUserId ? `Staff: ${assignedStaffName}` : null,
        providerName ? `Provider: ${providerName}` : null,
        providerWorkerName ? `Worker: ${providerWorkerName}` : null,
    ].filter(Boolean).join(" | ") || "No current assignment";
    const routeLabel = request?.policy?.route ? policyRouteLabels[request.policy.route as keyof typeof policyRouteLabels] ?? request.policy.route : "Pending";
    const recommendationLabel = request?.policy?.recommendation ? recommendationLabels[request.policy.recommendation as keyof typeof recommendationLabels] ?? request.policy.recommendation : "Pending";
    const recommendationClass = request?.policy?.recommendation ? recommendationStyles[request.policy.recommendation as keyof typeof recommendationStyles] ?? "border-zinc-200 bg-zinc-100 text-zinc-700" : "border-zinc-200 bg-zinc-100 text-zinc-700";
    const queueLabel = activeQueue ? requestQueueLabels[activeQueue] ?? activeQueue : "No queue";
    const ownerApprovalLabel = ownerApprovalStatusLabels[ownerApprovalStatus as keyof typeof ownerApprovalStatusLabels] ?? ownerApprovalStatus;
    const ownerApprovalClass = ownerApprovalStatusStyles[ownerApprovalStatus as keyof typeof ownerApprovalStatusStyles] ?? "";
    const estimateLabel = estimateStatusLabels[estimateStatus as keyof typeof estimateStatusLabels] ?? estimateStatus;
    const estimateClass = estimateStatusStyles[estimateStatus as keyof typeof estimateStatusStyles] ?? "";
    const statusLabel = request ? statusLabels[request.status] ?? request.status : "";
    const hasDraftEstimateAmount = Boolean(estimatedAmount.trim());
    const existingApprovalAmount = request?.ownerApproval?.estimatedAmount?.trim() ?? "";
    const existingApprovalCurrency = request?.ownerApproval?.estimatedCurrency?.trim() ?? "";
    const approvalAmountSummary = existingApprovalAmount
        ? `${existingApprovalAmount}${existingApprovalCurrency ? ` ${existingApprovalCurrency}` : ""}`
        : null;
    const estimateActionMode = getRequestDetailEstimateActionMode({
        requestQueue: request?.queue,
        policyRoute: request?.policy?.route,
        activeQueue,
        hasDraftEstimateAmount,
        ownerApprovalRejected,
    });
    const shouldShowEditableWorkflowInputs = ownerApprovalRejected
        || activeQueue === "NEEDS_ESTIMATE"
        || activeQueue === "AWAITING_ESTIMATE"
        || (request?.queue === "NEW" && request?.policy?.route === "NEEDS_ESTIMATE")
        || (request?.queue === "NEW" && request?.policy?.route === "OWNER_APPROVAL_REQUIRED");
    const shouldShowStatusBadge = Boolean(statusLabel) && statusLabel !== queueLabel;
    const ownerApprovalRecoverySummary = ownerApprovalRejected
        ? "The owner rejected this approval request. Revise the estimate or request details and submit again."
        : null;
    const ownerReminderLabel = estimateStatus === "SUBMITTED" ? "Re-request Owner Approval" : "Send Reminder";

    const parseEstimatedAmount = () => {
        const trimmed = estimatedAmount.trim();
        if (!trimmed) return null;
        const value = Number(trimmed);
        if (Number.isNaN(value)) {
            toast.error("Estimated amount must be a valid number.");
            return null;
        }
        return value;
    };

    const workflowPayload = () => {
        const amount = parseEstimatedAmount();
        if (estimatedAmount.trim() && amount == null) return null;
        let deadlineAt: string | null = null;
        if (ownerApprovalDeadlineAt.trim()) {
            const parsed = new Date(ownerApprovalDeadlineAt);
            if (Number.isNaN(parsed.getTime())) {
                toast.error("Owner approval deadline must be a valid date and time.");
                return null;
            }
            deadlineAt = parsed.toISOString();
        }
        return {
            estimatedAmount: amount,
            estimatedCurrency: estimatedCurrency.trim() ? estimatedCurrency.trim().toUpperCase() : null,
            approvalRequiredReason: approvalReason.trim() || null,
            isEmergency,
            isLikeForLike,
            isUpgrade,
            isMajorReplacement,
            isResponsibilityDisputed,
            ownerApprovalDeadlineAt: deadlineAt,
        };
    };

    const mutateGuard = async (action: () => Promise<unknown>, success: string, failure: string) => {
        try {
            await action();
            toast.success(success);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : failure);
        }
    };

    const handleAssignStaff = async () => {
        if (!request || !requestBuildingId || !canAssign) return;
        if (!selectedStaffUserId) {
            openSection("assignment");
            return;
        }
        await mutateGuard(() => assignRequest.mutateAsync({ requestId: request.id, assignedToId: selectedStaffUserId, buildingId: requestBuildingId }), "Staff assigned", "Failed to assign staff");
    };

    const handleAssignProvider = async (successMessage = "Provider assigned") => {
        if (!request || !requestBuildingId || !canAssign) return;
        const providerId = selectedServiceProviderId || request.serviceProvider?.id;
        if (!providerId) {
            openSection("assignment");
            return;
        }
        await mutateGuard(() => assignProvider.mutateAsync({ requestId: request.id, serviceProviderId: providerId, buildingId: requestBuildingId }), successMessage, "Failed to assign provider");
    };

    const handleApplyAssignment = async () => {
        if (!request || !requestBuildingId || !canAssign) return;

        const nextStaffId = selectedStaffUserId.trim();
        const nextProviderId = selectedServiceProviderId.trim();
        const shouldUpdateStaff = Boolean(nextStaffId) && nextStaffId !== currentStaffUserId;
        const shouldUpdateProvider = Boolean(nextProviderId) && nextProviderId !== currentProviderId;

        if (!shouldUpdateStaff && !shouldUpdateProvider) {
            openSection("assignment");
            return;
        }

        if (shouldUpdateStaff && shouldUpdateProvider) {
            openSection("assignment");
            toast.error("Choose either a staff member or a provider before assigning. Apply them one at a time.");
            return;
        }

        try {
            if (shouldUpdateStaff) {
                await assignRequest.mutateAsync({ requestId: request.id, assignedToId: nextStaffId, buildingId: requestBuildingId });
            } else if (shouldUpdateProvider) {
                await assignProvider.mutateAsync({ requestId: request.id, serviceProviderId: nextProviderId, buildingId: requestBuildingId });
            }

            if (shouldUpdateStaff) {
                toast.success(hasExistingAssignment ? "Staff reassigned" : "Staff assigned");
            } else {
                toast.success(hasExistingAssignment ? "Provider reassigned" : "Provider assigned");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update assignment");
        }
    };

    const handleReassign = async () => {
        if (!request) return;
        if (request.serviceProvider) {
            openSection("assignment");
            return;
        }
        if (selectedStaffUserId && selectedStaffUserId !== request.assignedEmployeeId) {
            await handleAssignStaff();
            return;
        }
        openSection("assignment");
    };

    const handleRequestOrUploadEstimate = async () => {
        if (!requestId || !requestBuildingId || !canAssign) return;
        const amount = parseEstimatedAmount();
        if (amount != null) {
            const payload = workflowPayload();
            if (!payload) return;
            await mutateGuard(() => submitEstimate.mutateAsync({ requestId, buildingId: requestBuildingId, payload: { ...payload, estimatedAmount: amount } }), "Estimate submitted", "Failed to submit estimate");
            return;
        }
        const providerId = selectedServiceProviderId || request?.serviceProvider?.id;
        if (!providerId) {
            openSection("assignment");
            openSection("workflow");
            toast.error("Select a provider or enter an estimate amount first.");
            return;
        }
        await mutateGuard(() => requestEstimate.mutateAsync({ requestId, buildingId: requestBuildingId, serviceProviderId: providerId }), "Estimate requested", "Failed to request estimate");
    };

    const handleUploadEstimate = async () => {
        if (!estimatedAmount.trim()) {
            openSection("workflow");
            return;
        }
        await handleRequestOrUploadEstimate();
    };

    const handleRequestOwnerApproval = async () => {
        if (!request || !requestBuildingId || !canAssign) return;
        const payload = workflowPayload();
        if (!payload) return;
        await mutateGuard(() => requestApproval.mutateAsync({ requestId: request.id, buildingId: requestBuildingId, payload }), "Owner approval requested", "Failed to request owner approval");
    };

    const handleSaveTriage = async () => {
        if (!request || !requestBuildingId || !canAssign) return;
        const payload = workflowPayload();
        if (!payload) return;
        await mutateGuard(
            () => saveTriage.mutateAsync({
                requestId: request.id,
                buildingId: requestBuildingId,
                payload: {
                    estimatedAmount: payload.estimatedAmount,
                    estimatedCurrency: payload.estimatedCurrency,
                    isEmergency,
                    isLikeForLike,
                    isUpgrade,
                    isMajorReplacement,
                    isResponsibilityDisputed,
                },
            }),
            "Triage saved",
            "Failed to save triage"
        );
    };

    const handleReviseEstimate = async () => {
        if (!requestId || !requestBuildingId || !canAssign) return;
        const amount = parseEstimatedAmount();
        if (amount == null) {
            toast.error("Enter an estimate amount before submitting.");
            return;
        }
        const payload = workflowPayload();
        if (!payload) return;
        try {
            await submitEstimate.mutateAsync({ requestId, buildingId: requestBuildingId, payload: { ...payload, estimatedAmount: amount } });
            setIsReviseEstimateOpen(false);
            toast.success("Revised estimate submitted");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to submit revised estimate");
        }
    };

    const handlePostComment = async () => {
        if (!request || !requestBuildingId || !canComment || !commentText.trim()) return;
        await mutateGuard(() => addComment.mutateAsync({ requestId: request.id, buildingId: requestBuildingId, commentText: commentText.trim(), visibility: canSeeInternalComments ? commentVisibility : "SHARED" }), "Comment posted", "Failed to post comment");
        setCommentText("");
    };

    const handleProgressReview = async () => {
        const result = await submitProgressReviewComment({
            requestId: request?.id,
            buildingId: requestBuildingId,
            canComment,
            hasDraft: Boolean(commentText.trim()),
            canSeeInternalComments,
            commentVisibility,
            isOverdue,
            submitComment: (payload) => addComment.mutateAsync(payload),
        });

        if (result.status === "posted") {
            toast.success(result.message);
            return;
        }
        if (result.status === "blocked" || result.status === "failed") {
            toast.error(result.message);
        }
    };

    const handleUploadAdminAttachments = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        if (!requestId || !requestBuildingId || files.length === 0) return;
        try {
            const uploadedAttachments = await Promise.all(files.map(async (file) => {
                const upload = await uploadToCloudinary(file, file.type.startsWith("image/") ? "image" : "raw");
                return { fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, url: upload.url };
            }));
            await addAttachments.mutateAsync({ requestId, buildingId: requestBuildingId, attachments: uploadedAttachments });
            toast.success(files.length === 1 ? "Admin attachment uploaded" : "Admin attachments uploaded");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to upload admin attachment");
        } finally {
            event.target.value = "";
        }
    };

    const primaryAction = (() => {
        if (!request || !activeQueue) return null;
        if (ownerApprovalRejected) return { key: "revise-estimate", label: "Revise Estimate", onClick: () => setIsReviseEstimateOpen(true), disabled: !canAssign };
        if (request.queue === "NEW" && request.policy?.route === "DIRECT_ASSIGN") return { key: "assign-staff", label: "Assign Staff", onClick: handleAssignStaff, disabled: !canAssign };
        if (request.queue === "NEW" && request.policy?.route === "EMERGENCY_DISPATCH") return {
            key: "dispatch-now",
            label: "Dispatch Now",
            onClick: async () => {
                if (selectedStaffUserId) return handleAssignStaff();
                if (selectedServiceProviderId || request.serviceProvider?.id) return handleAssignProvider();
                openSection("assignment");
            },
            disabled: !canAssign,
        };
        if (request.queue === "NEW" && request.policy?.route === "NEEDS_ESTIMATE") {
            return {
                key: estimateActionMode === "submit" ? "submit-estimate" : "request-estimate",
                label: estimateActionMode === "submit" ? "Submit Estimate" : "Request Estimate",
                onClick: handleRequestOrUploadEstimate,
                disabled: !canAssign,
            };
        }
        if (request.queue === "NEW" && request.policy?.route === "OWNER_APPROVAL_REQUIRED") return { key: "request-owner-approval", label: "Request Owner Approval", onClick: handleRequestOwnerApproval, disabled: !canAssign };
        if (activeQueue === "NEEDS_ESTIMATE") {
            return {
                key: estimateActionMode === "submit" ? "submit-estimate" : "request-estimate",
                label: estimateActionMode === "submit" ? "Submit Estimate" : "Request Estimate",
                onClick: handleRequestOrUploadEstimate,
                disabled: !canAssign,
            };
        }
        if (activeQueue === "AWAITING_OWNER") return { key: "waiting-owner", label: "Waiting for Owner", onClick: () => void 0, disabled: true };
        if (activeQueue === "READY_TO_ASSIGN") return { key: "assign-staff", label: "Assign Staff", onClick: handleAssignStaff, disabled: !canAssign };
        if (activeQueue === "IN_PROGRESS") return { key: "review-progress", label: isOverdue ? "Escalate Progress Review" : "Review Progress", onClick: handleProgressReview, disabled: !canComment || addComment.isPending };
        return null;
    })();

    const secondaryActions: ActionDefinition[] = [];
    if (request && activeQueue) {
        if (ownerApprovalRejected) {
            secondaryActions.push({ key: "edit-triage", label: "Edit Triage", onClick: () => setIsReviseEstimateOpen(true), disabled: !canAssign });
        } else {
            if (request.queue === "NEW" && request.policy?.route === "DIRECT_ASSIGN") secondaryActions.push({ key: "assign-provider", label: "Assign Provider", onClick: () => handleAssignProvider(), disabled: !canAssign });
            if (request.queue === "NEW" && request.policy?.route === "EMERGENCY_DISPATCH") {
                secondaryActions.push({ key: "assign-staff", label: "Assign Staff", onClick: handleAssignStaff, disabled: !canAssign });
                secondaryActions.push({ key: "assign-provider", label: "Assign Provider", onClick: () => handleAssignProvider(), disabled: !canAssign });
            }
            if (request.queue === "NEW" && request.policy?.route === "OWNER_APPROVAL_REQUIRED") secondaryActions.push({ key: "edit-triage", label: "Edit Triage", onClick: () => openSection("advanced"), disabled: !canAssign });
            if (activeQueue === "NEEDS_ESTIMATE") secondaryActions.push({ key: "assign-provider-estimate", label: "Assign Provider For Estimate", onClick: () => handleAssignProvider(), disabled: !canAssign });
            if (activeQueue === "AWAITING_ESTIMATE") {
                secondaryActions.push({ key: "reassign-estimate-provider", label: "Reassign Estimate Provider", onClick: () => handleAssignProvider("Estimate provider reassigned"), disabled: !canAssign });
                secondaryActions.push({ key: "add-comment", label: "Add Comment", onClick: () => setCommentText((draft) => draft || "Following up on the requested estimate."), disabled: !canComment });
            }
            if (activeQueue === "AWAITING_OWNER") secondaryActions.push({ key: "send-reminder", label: ownerReminderLabel, onClick: () => mutateGuard(() => sendReminder.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Reminder sent", "Failed to send reminder"), disabled: !canAssign });
            if (activeQueue === "READY_TO_ASSIGN") secondaryActions.push({ key: "assign-provider", label: "Assign Provider", onClick: () => handleAssignProvider(), disabled: !canAssign });
            if (activeQueue === "ASSIGNED") {
                secondaryActions.push({ key: "reassign", label: "Reassign", onClick: handleReassign, disabled: !canAssign });
                secondaryActions.push({ key: "add-comment", label: "Add Comment", onClick: () => setCommentText((draft) => draft || "Coordination update."), disabled: !canComment });
            }
            if (activeQueue === "IN_PROGRESS") secondaryActions.push({ key: "add-comment", label: "Add Comment", onClick: () => setCommentText((draft) => draft || "Progress update."), disabled: !canComment });
        }
    }

    const visibleSecondaryActions = secondaryActions.slice(0, 2);
    const shouldShowOwnerBadge = ownerApprovalStatus !== "NOT_REQUIRED";
    const shouldShowEstimateBadge = estimateStatus !== "NOT_REQUESTED" || activeQueue === "NEEDS_ESTIMATE" || activeQueue === "AWAITING_ESTIMATE";
    const ownerApprovalSummary = shouldShowOwnerBadge
        ? `${ownerApprovalLabel}${request?.ownerApproval?.deadlineAt && ownerApprovalPending ? ` | Deadline ${formatDateTime(request.ownerApproval.deadlineAt)}` : request?.ownerApproval?.decidedAt && ownerApprovalRejected ? ` | Decided ${formatDateTime(request.ownerApproval.decidedAt)}` : ""}`
        : null;
    const estimateSummary = shouldShowEstimateBadge ? `${estimateLabel}${request?.estimate?.dueAt && estimateRequested ? ` | Due ${formatDateTime(request.estimate.dueAt)}` : ""}` : null;
    const blockMessage = ownerApprovalRejected
        ? "Execution is blocked until the estimate or request details are revised."
        : ownerApprovalPending
          ? "Execution is blocked while owner approval is pending."
          : estimateRequested
            ? "Execution is blocked while the estimate workflow is active."
            : activeQueue === "ASSIGNED"
              ? "Execution ownership sits with the assigned staff or provider worker. Management should coordinate, not advance work by default."
              : activeQueue === "IN_PROGRESS"
                ? "Execution is owned by the assigned actor. Management should review updates and handle exceptions."
                : null;
    const shouldShowWorkflowRoute = Boolean(request?.policy?.route);
    const shouldShowWorkflowRecommendation = Boolean(request?.policy?.recommendation);
    const shouldShowWorkflowSummary = Boolean(request?.policy?.summary?.trim());
    const workflowSummaryLine = [queueLabel, shouldShowWorkflowRoute ? routeLabel : null, ownerApprovalSummary ?? estimateSummary ?? null].filter(Boolean).join(" | ");
    const showFilesSection = attachments.length > 0;
    const showMoreActions = canAssign || canUpdateStatus || canComment;
    const summaryNote = request?.policy?.summary?.trim()
        || (ownerApprovalRejected ? "Owner approval was rejected. Revise before continuing." : null)
        || (ownerApprovalPending ? "Owner approval is pending." : null)
        || (estimateRequested ? "Estimate workflow is active." : null);
    const hasExistingAssignment = Boolean(currentStaffUserId || currentProviderId);
    const hasStaffAssignmentChange = Boolean(selectedStaffUserId.trim()) && selectedStaffUserId.trim() !== currentStaffUserId;
    const hasProviderAssignmentChange = Boolean(selectedServiceProviderId.trim()) && selectedServiceProviderId.trim() !== currentProviderId;
    const hasConflictingAssignmentChange = hasStaffAssignmentChange && hasProviderAssignmentChange;
    const hasPendingAssignmentChange = hasStaffAssignmentChange || hasProviderAssignmentChange;
    const pendingAssignmentTarget = hasStaffAssignmentChange
        ? { label: "Staff", value: selectedStaffName }
        : hasProviderAssignmentChange
            ? { label: "Provider", value: selectedProviderName }
            : null;
    const assignmentActionLabel = hasConflictingAssignmentChange
        ? "Choose One Assignee"
        : hasStaffAssignmentChange
            ? hasExistingAssignment ? "Reassign Staff" : "Assign Staff"
            : hasProviderAssignmentChange
                ? hasExistingAssignment ? "Reassign Provider" : "Assign Provider"
                : hasExistingAssignment ? "Reassign" : "Assign";
    const showCoordinationHeaderCard = !ownerApprovalRejected && !ownerApprovalPending && !estimateRequested && Boolean(blockMessage);
    const showNextActionCard = Boolean(primaryAction) || visibleSecondaryActions.length === 0 || showCoordinationHeaderCard;
    const headerSecondaryActions = showCoordinationHeaderCard ? [] : visibleSecondaryActions;
    const nextActionHeading = primaryAction ? "Next action" : showCoordinationHeaderCard ? "Coordination view" : visibleSecondaryActions.length > 0 ? "Follow-up tools" : "State summary";
    const nextActionTitle = primaryAction?.label ?? (showCoordinationHeaderCard ? "Coordination view" : visibleSecondaryActions.length > 0 ? "No primary action right now" : "No immediate action needed");
    const nextActionHelper = showCoordinationHeaderCard
        ? blockMessage ?? "Management should coordinate, not advance work by default."
        : ownerApprovalRejected
        ? "Revise the estimate or triage facts so the backend can reroute the request."
        : ownerApprovalPending
          ? "Execution stays paused until the owner responds or management uses an approved exception path."
          : activeQueue === "AWAITING_ESTIMATE"
            ? estimateActionMode === "workflow-submit"
                ? "A manual estimate is ready. Submit it from Workflow details if management needs to take over."
                : "Stay in coordination mode while the provider prepares the quote."
            : activeQueue === "READY_TO_ASSIGN"
              ? "Ownership is still open. Choose the staff or provider who should take the work."
              : activeQueue === "ASSIGNED"
                ? "The assigned actor owns execution. Use reassignment and comments when plans change."
                : activeQueue === "IN_PROGRESS"
                  ? isOverdue ? "Progress needs attention. Review updates and escalate if needed." : "Review progress, keep communication flowing, and handle exceptions."
                  : activeQueue === "NEW" || activeQueue === "NEEDS_ESTIMATE"
                    ? "Use the system recommendation to move the request into the correct workflow."
                    : "The current workflow does not require a direct action right now.";
    const stateBanners = [
        ownerApprovalRejected
            ? {
                tone: "danger" as const,
                title: "Owner rejected",
                body: [ownerApprovalRecoverySummary, blockMessage].filter(Boolean).join(" "),
            }
            : null,
        !ownerApprovalRejected && ownerApprovalPending
            ? {
                tone: "warning" as const,
                title: "Awaiting owner approval",
                body: [`Owner approval: ${ownerApprovalSummary ?? ownerApprovalLabel}.`, blockMessage].filter(Boolean).join(" "),
            }
            : null,
        !ownerApprovalRejected && !ownerApprovalPending && estimateRequested
            ? {
                tone: "info" as const,
                title: "Estimate workflow active",
                body: [`Estimate workflow: ${estimateSummary ?? estimateLabel}.`, blockMessage].filter(Boolean).join(" "),
            }
            : null,
    ].filter((banner): banner is { tone: "danger" | "warning" | "info"; title: string; body: string } => Boolean(banner));
    const assignmentNote = ownerApprovalRejected
        ? "Assignment stays secondary until the revised estimate is resubmitted."
        : activeQueue === "READY_TO_ASSIGN" || (request?.queue === "NEW" && request?.policy?.route === "DIRECT_ASSIGN")
          ? "Dispatch is the main decision here."
          : "Keep assignment tidy, but let workflow state drive the primary action.";
    const currentAssignmentItems = [
        currentStaffUserId ? `Staff: ${assignedStaffName}` : null,
        currentProviderId ? `Provider: ${providerName}` : null,
        providerWorkerName ? `Worker: ${providerWorkerName}` : null,
    ].filter(Boolean);
    const currentAssignmentValue = currentAssignmentItems.length > 0 ? (
        <div className="space-y-1">
            {currentAssignmentItems.map((item) => (
                <div key={item} className="text-sm font-semibold text-[#2e3145]">
                    {item}
                </div>
            ))}
        </div>
    ) : "Unassigned";
    const detailColumns = [
        [
            { label: "Created", value: formatDateTime(request?.createdAt) },
            {
                label: "Priority",
                value: (
                    <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
                        {request?.priority ? `${request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}${isOverdue ? " / Overdue" : ""}` : "N/A"}
                    </span>
                ),
            },
            { label: "Requested By", value: requestedByName },
            { label: "Currently Assigned", value: currentAssignmentValue },
        ],
        [
            { label: "Updated", value: formatDateTime(request?.updatedAt) },
            { label: "Unit", value: unitMeta },
            { label: "Building", value: buildingName || "N/A" },
        ],
    ];

    if (!requestId) return null;

    return (
        <Dialog open={!!requestId} onOpenChange={(open) => !open && onClose()} modal={false}>
            <DialogContent className={`flex h-[94vh] w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden border ${STITCH_BORDER} ${STITCH_SURFACE} p-0 shadow-[0px_20px_50px_-12px_rgba(46,49,69,0.12)] sm:max-w-[calc(100vw-2rem)] 2xl:max-w-[1480px]`}>
                <DialogTitle className="sr-only">Request details</DialogTitle>
                {isLoading ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>
                ) : !request ? (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">Request not found.</div>
                ) : (
                    <div className={`flex-1 overflow-y-auto ${STITCH_SURFACE} p-4 sm:p-6`}>
                        <section className={`overflow-hidden rounded-xl border ${STITCH_BORDER} ${STITCH_PANEL} shadow-[0px_20px_50px_-12px_rgba(46,49,69,0.06)]`}>
                            <div className={`grid gap-6 border-b border-[#aeb0c9]/10 px-6 py-8 sm:px-8 ${STITCH_PANEL_SOFT} ${showNextActionCard ? "xl:grid-cols-[minmax(0,1.7fr)_320px]" : ""}`}>
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {activeQueue ? <Badge data-request-badge="queue" variant="outline" className="rounded-full border-0 bg-[#dbe1ff] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#0048bf] shadow-none">Queue: {queueLabel}</Badge> : null}
                                            {request?.priority ? <Badge variant="outline" className="rounded-full border-0 bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800 shadow-none">Priority: {request.priority}</Badge> : null}
                                            {shouldShowStatusBadge ? <Badge data-request-badge="status" variant="outline" className="rounded-full border-0 bg-[#7ff3be] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#005a3d] shadow-none">Status: {statusLabel}</Badge> : null}
                                            {requesterStatusBadge ? <Badge variant="outline" className="rounded-full border-0 bg-violet-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-800 shadow-none">{requesterStatusBadge}</Badge> : null}
                                            {shouldShowOwnerBadge ? <Badge variant="outline" className={`rounded-full border-0 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] shadow-none ${ownerApprovalPending ? "bg-amber-100 text-amber-800" : ownerApprovalRejected ? "bg-rose-100 text-rose-800" : "bg-[#dbe1ff] text-[#0048bf]"} ${ownerApprovalClass}`}>{ownerApprovalLabel}</Badge> : null}
                                            {shouldShowEstimateBadge ? <Badge variant="outline" className={`rounded-full border-0 bg-[#e4e1e6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#525155] shadow-none ${estimateClass}`}>Estimate: {estimateLabel}</Badge> : null}
                                            {isOverdue ? <Badge variant="outline" className="rounded-full border-0 bg-rose-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-800 shadow-none">Overdue</Badge> : null}
                                        </div>

                                        <div className="space-y-4 pt-2">
                                            <div>
                                                <h2 className={`max-w-4xl text-4xl font-extrabold tracking-tight ${STITCH_TEXT} sm:text-5xl`}>{request.title}</h2>
                                                {summaryNote ? <p className={`mt-3 max-w-3xl text-base leading-7 ${STITCH_MUTED}`}>{summaryNote}</p> : null}
                                            </div>
                                        </div>

                                    </div>

                                {showNextActionCard ? (
                                    <div className="xl:pl-2">
                                        <div className="rounded-xl border border-[#0053dc]/10 bg-[#dbe1ff] p-6 shadow-sm">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0048bf]">{nextActionHeading}</div>
                                                    <div className="mt-2 text-2xl font-bold tracking-tight text-[#2e3145]">{nextActionTitle}</div>
                                                </div>
                                            </div>
                                            {shouldShowWorkflowRoute ? <div className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[#0048bf]/70">Route: {routeLabel}</div> : null}
                                            <p className="mt-3 text-sm leading-6 text-[#0048bf]/80">{nextActionHelper}</p>
                                            <div className="mt-5 flex flex-col gap-2.5">
                                                {primaryAction ? (
                                                    <Button className="h-11 w-full rounded-lg border-0 bg-[#0053dc] text-sm font-bold text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.2)] hover:bg-[#0049c2]" onClick={() => void primaryAction.onClick()} disabled={Boolean(primaryAction.disabled)}>
                                                        {primaryAction.label}
                                                    </Button>
                                                ) : null}
                                                {headerSecondaryActions.map((action) => (
                                                    <Button key={action.key} variant="outline" className="h-10 w-full justify-start rounded-lg border-0 bg-white/70 text-sm font-semibold text-[#2e3145] shadow-none hover:bg-white" onClick={() => void action.onClick()} disabled={Boolean(action.disabled)}>
                                                        {action.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid lg:grid-cols-12">
                                <div className="space-y-10 p-6 sm:p-8 lg:col-span-8">
                                    {stateBanners.length > 0 ? (
                                        <section className="grid gap-3 lg:grid-cols-2">
                                            {stateBanners.map((banner) => (
                                                <Banner key={`${banner.title}-${banner.body}`} title={banner.title} body={banner.body} tone={banner.tone} />
                                            ))}
                                        </section>
                                    ) : null}

                                    <section>
                                        <div className="mb-6 text-xs font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Key details</div>
                                        <div className="grid gap-6">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Description</div>
                                                <div className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${STITCH_TEXT}`}>{request.description || "No description"}</div>
                                            </div>
                                            <div className="grid gap-8 md:grid-cols-2">
                                                {detailColumns.map((column, index) => (
                                                    <div key={`detail-column-${index}`}>
                                                        {column.map((item, itemIndex) => (
                                                            <SummaryTableRow
                                                                key={`${item.label}-${itemIndex}`}
                                                                label={item.label}
                                                                value={item.value}
                                                                borderClass={itemIndex === column.length - 1 ? "" : "border-b border-[#aeb0c9]/15"}
                                                            />
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                            {shouldShowResidentContext ? (
                                                <div className="rounded-xl border border-[#aeb0c9]/15 bg-[#f8f7ff] p-4">
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Resident context</div>
                                                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                                                        {request?.requesterContext ? (
                                                            <div>
                                                                <SummaryTableRow
                                                                    label="Resident status"
                                                                    value={managementRequesterStatus ?? "Not provided"}
                                                                    borderClass={managementRequesterInvite ? "border-b border-[#aeb0c9]/15" : ""}
                                                                />
                                                                {managementRequesterInvite ? (
                                                                    <SummaryTableRow
                                                                        label="Onboarding"
                                                                        value={managementRequesterInvite}
                                                                        borderClass=""
                                                                    />
                                                                ) : null}
                                                            </div>
                                                        ) : null}
                                                        <div>
                                                            <SummaryTableRow
                                                                label="Unit occupancy now"
                                                                value={managementRequesterOccupancy}
                                                                borderClass=""
                                                            />
                                                        </div>
                                                    </div>
                                                    {requesterContextNotes.length > 0 ? (
                                                        <div className="mt-4 space-y-2">
                                                            {requesterContextNotes.map((note) => (
                                                                <div key={note} className="rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                                                    {note}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {shouldShowRequestCycle && (tenancyCycleBadge || leaseCycleBadge) ? (
                                                <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-4">
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-800">Request cycle</div>
                                                    <div className="mt-4 grid gap-6 md:grid-cols-2">
                                                        <SummaryTableRow
                                                            label="Stay context"
                                                            value={(
                                                                <div className="space-y-1">
                                                                    <div>{tenancyCycleBadge}</div>
                                                                    {tenancyCycleSourceText ? <div className="text-xs font-normal text-sky-900/70">{tenancyCycleSourceText}</div> : null}
                                                                </div>
                                                            )}
                                                            borderClass=""
                                                        />
                                                        <SummaryTableRow
                                                            label="Lease context"
                                                            value={(
                                                                <div className="space-y-1">
                                                                    <div>{leaseCycleBadge}</div>
                                                                    {leaseCycleSourceText ? <div className="text-xs font-normal text-sky-900/70">{leaseCycleSourceText}</div> : null}
                                                                </div>
                                                            )}
                                                            borderClass=""
                                                        />
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </section>

                                    <section className="space-y-8">
                                        <div className="flex items-center justify-between border-b border-[#aeb0c9]/15 pb-4">
                                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Activity & Comments</div>
                                    <div className="text-xs font-medium text-[#5b5e74]">{attachments.length} Files</div>
                                </div>
                                        <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                                    <div className="space-y-4">
                                        <div className="text-sm font-semibold text-[#2e3145]">Attachments</div>

                                        {attachmentPreviewItems.length > 0 ? (
                                            <div className="space-y-2">
                                                {attachmentPreviewItems.map((attachment) => (
                                                    <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#2e3145] transition hover:bg-zinc-50">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f3f2ff] text-[#0053dc]">
                                                            {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                        </span>
                                                        <span className="min-w-0 flex-1 truncate font-medium">{attachment.fileName}</span>
                                                        <span className="text-xs text-[#5b5e74]">{formatFileSize(attachment.sizeBytes) ?? "File"}</span>
                                                    </a>
                                                ))}
                                                {moreAttachmentCount > 0 ? <div className="px-3 text-xs text-[#5b5e74]">+ {moreAttachmentCount} more in Files</div> : null}
                                            </div>
                                        ) : (
                                            <div className="rounded-lg bg-[#f3f2ff] px-4 py-10 text-center text-sm text-[#5b5e74]">No files yet.</div>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="text-sm font-semibold text-[#2e3145]">Comments</div>

                                        {visibleComments.length === 0 ? (
                                            <div className="rounded-lg bg-[#f3f2ff] px-4 py-10 text-center text-sm text-[#5b5e74]">No comments yet.</div>
                                        ) : commentsToRender.map((comment) => (
                                            <div key={comment.id} className="flex gap-4">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e4e1e6] text-[10px] font-bold text-[#525155]">
                                                    {(comment.user?.fullName ?? comment.user?.email ?? "U").slice(0, 1).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-bold text-[#2e3145]">{comment.user?.fullName ?? comment.user?.email ?? "User"}</span>
                                                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${comment.visibility === "INTERNAL" ? "bg-zinc-100 text-zinc-600" : "bg-[#7ff3be] text-[#005a3d]"}`}>
                                                            {comment.visibility ?? "SHARED"}
                                                        </span>
                                                        <span className="text-[10px] text-[#5b5e74]">{formatDateTime(comment.createdAt)}</span>
                                                    </div>
                                                    <p className="text-sm leading-relaxed text-[#2e3145]">{comment.commentText}</p>
                                                </div>
                                            </div>
                                        ))}

                                        <div className="rounded-xl bg-[#f3f2ff] p-4">
                                            <div className="mb-3 flex items-center justify-between">
                                                <div className="flex rounded-lg bg-zinc-200/50 p-1">
                                                    {canSeeInternalComments ? (
                                                        <Select value={commentVisibility} onValueChange={(value) => setCommentVisibility(value as RequestCommentVisibility)}>
                                                            <SelectTrigger className="h-auto border-0 bg-transparent px-0 py-0 shadow-none">
                                                                <div className="flex items-center gap-1">
                                                                    <span className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase ${commentVisibility === "SHARED" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>Shared</span>
                                                                    <span className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase ${commentVisibility === "INTERNAL" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}>Internal</span>
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="SHARED">Shared</SelectItem>
                                                                <SelectItem value="INTERNAL">Internal</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span className="rounded-md bg-white px-3 py-1 text-[10px] font-bold uppercase text-zinc-900 shadow-sm">Shared</span>
                                                    )}
                                                </div>
                                                {collapsedCommentCount > 0 ? (
                                                    <Button variant="ghost" className="h-auto px-0 text-xs font-medium text-[#5b5e74] hover:bg-transparent" onClick={() => setShowAllComments((current) => !current)}>
                                                        {showAllComments ? "Show fewer comments" : `Show ${collapsedCommentCount} older comment${collapsedCommentCount === 1 ? "" : "s"}`}
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a comment..." className="min-h-24 border-0 bg-white text-sm shadow-none focus-visible:ring-2 focus-visible:ring-[#0053dc]/20" />
                                            <div className="mt-3 flex justify-end">
                                                <Button className="h-9 rounded-lg bg-[#5f5e61] px-6 text-xs font-bold text-white hover:bg-[#535255]" onClick={() => void handlePostComment()} disabled={!canComment || !commentText.trim()}>
                                                    Post Comment
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                        </div>
                                    </section>
                                </div>

                                <aside className="space-y-4 border-t border-[#aeb0c9]/10 bg-zinc-50/55 p-4 sm:p-8 lg:col-span-4 lg:border-l lg:border-t-0">
                                    <DisclosureSection title="Assignment" summary={assignmentSummary} detailsRef={registerSection("assignment")} defaultOpen>
                                        <div className="space-y-4">
                                            {currentStaffUserId ? (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Current Staff</Label>
                                                    <div className="text-sm font-semibold text-[#2e3145]">{assignedStaffName}</div>
                                                </div>
                                            ) : null}
                                            {providerName ? (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Current Provider</Label>
                                                    <div className="text-sm font-semibold text-[#2e3145]">{providerName}</div>
                                                </div>
                                            ) : null}
                                            {providerWorkerName ? (
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Provider Worker</Label>
                                                    <div className="text-sm font-semibold text-[#2e3145]">{providerWorkerName}</div>
                                                </div>
                                            ) : null}

                                            <div className="space-y-2">
                                                <Label>Assignment Target</Label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAssignmentTarget("staff")}
                                                        className={assignmentTarget === "staff"
                                                            ? "rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white"
                                                            : "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#5b5e74] transition-colors hover:border-zinc-300 hover:text-[#2e3145]"}
                                                    >
                                                        Staff
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectAssignmentTarget("provider")}
                                                        className={assignmentTarget === "provider"
                                                            ? "rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white"
                                                            : "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#5b5e74] transition-colors hover:border-zinc-300 hover:text-[#2e3145]"}
                                                    >
                                                        Provider
                                                    </button>
                                                </div>
                                                <div className="text-xs leading-5 text-[#5b5e74]">
                                                    Choose who should own the next assignment, then pick that assignee below.
                                                </div>
                                            </div>

                                            {assignmentTarget === "staff" ? (
                                                <div className="space-y-1">
                                                    <Label>Assign Staff</Label>
                                                    <Select value={selectedStaffUserId || "__none__"} onValueChange={handleSelectStaffAssignment}>
                                                        <SelectTrigger className={hasStaffAssignmentChange ? "border border-zinc-900 bg-white shadow-none" : "border-0 bg-[#f3f2ff] shadow-none"}><SelectValue placeholder="Select staff" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">Unassigned</SelectItem>
                                                            {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName ?? employee.name ?? employee.email}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <Label>Assign Provider</Label>
                                                    <Select value={selectedServiceProviderId || "__none__"} onValueChange={handleSelectProviderAssignment}>
                                                        <SelectTrigger className={hasProviderAssignmentChange ? "border border-zinc-900 bg-white shadow-none" : "border-0 bg-[#f3f2ff] shadow-none"}><SelectValue placeholder="Select provider" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">Unassigned</SelectItem>
                                                            {availableProviders.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}

                                            {hasConflictingAssignmentChange ? (
                                                <Banner
                                                    title="Choose one assignment target"
                                                    body="Both draft selections changed, so the next assignee is ambiguous. Keep either the staff change or the provider change, then apply."
                                                    tone="warning"
                                                />
                                            ) : pendingAssignmentTarget ? (
                                                <div className="rounded-xl border border-zinc-900/10 bg-white px-4 py-3">
                                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b5e74]">Pending Assignment</div>
                                                    <div className="mt-1 text-sm font-semibold text-[#2e3145]">
                                                        {pendingAssignmentTarget.label}: {pendingAssignmentTarget.value}
                                                    </div>
                                                    <div className="mt-1 text-xs leading-5 text-[#5b5e74]">
                                                        This is the assignee TowerDesk will apply when you confirm. Choosing one target clears the other draft selection.
                                                    </div>
                                                </div>
                                            ) : null}

                                            <Button className="h-10 w-full rounded-lg border-0 bg-zinc-900 text-xs font-bold text-white hover:bg-zinc-800 hover:text-white" onClick={() => void handleApplyAssignment()} disabled={!canAssign || ownerApprovalRejected || !hasPendingAssignmentChange || hasConflictingAssignmentChange}>
                                                {assignmentActionLabel}
                                            </Button>

                                            <div className="text-xs leading-5 text-[#5b5e74]">{assignmentNote}</div>
                                            {ownerApprovalRejected ? <Banner title="Assignment blocked" body="Assignment stays blocked until the estimate is revised and resubmitted." tone="danger" /> : null}
                                        </div>
                                    </DisclosureSection>

                                    <DisclosureSection title="Workflow details" summary={workflowSummaryLine || queueLabel} detailsRef={registerSection("workflow")}>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                <span className="text-xs font-medium text-[#5b5e74]">Queue</span>
                                                <span className="text-xs font-bold text-[#2e3145]">{queueLabel}</span>
                                            </div>
                                            <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                <span className="text-xs font-medium text-[#5b5e74]">Status</span>
                                                <span className="text-xs font-bold text-[#2e3145]">{statusLabel}</span>
                                            </div>
                                            {shouldShowWorkflowRoute ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Route</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{routeLabel}</span>
                                                </div>
                                            ) : null}
                                            {shouldShowWorkflowRecommendation ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Recommendation</span>
                                                    <span className={`text-xs font-bold ${recommendationClass}`.trim()}>{recommendationLabel}</span>
                                                </div>
                                            ) : null}
                                            {shouldShowEstimateBadge ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Estimate Status</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{estimateLabel}</span>
                                                </div>
                                            ) : null}
                                            {shouldShowOwnerBadge ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Owner Approval</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{ownerApprovalLabel}</span>
                                                </div>
                                            ) : null}
                                            {approvalAmountSummary ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Approval Amount</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{approvalAmountSummary}</span>
                                                </div>
                                            ) : null}
                                            {request?.ownerApproval?.deadlineAt ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Owner Approval Deadline</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{formatDateTime(request.ownerApproval.deadlineAt)}</span>
                                                </div>
                                            ) : null}
                                            {(request?.policy?.isEmergency ?? request?.isEmergency) != null ? (
                                                <div className="flex items-center justify-between border-b border-zinc-100 py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Emergency</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{formatBoolean(request?.policy?.isEmergency ?? request?.isEmergency)}</span>
                                                </div>
                                            ) : null}
                                            {(request?.policy?.isUpgrade ?? request?.isUpgrade) != null ? (
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-xs font-medium text-[#5b5e74]">Upgrade</span>
                                                    <span className="text-xs font-bold text-[#2e3145]">{formatBoolean(request?.policy?.isUpgrade ?? request?.isUpgrade)}</span>
                                                </div>
                                            ) : null}
                                            {shouldShowWorkflowSummary ? <div className="rounded-lg bg-[#f3f2ff] px-3 py-3 text-xs leading-5 text-[#5b5e74]">{request.policy?.summary ?? ""}</div> : null}
                                            {shouldShowEditableWorkflowInputs ? (
                                                <div className="space-y-3 rounded-lg bg-[#f3f2ff] p-3">
                                                    <div>
                                                        <Label htmlFor="estimate-amount">Estimated Amount</Label>
                                                        <Input id="estimate-amount" value={estimatedAmount} onChange={(event) => setEstimatedAmount(event.target.value)} placeholder="450" className="mt-1 border-0 bg-white" />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="estimate-currency">Estimated Currency</Label>
                                                        <Input id="estimate-currency" value={estimatedCurrency} disabled placeholder="AED" className="mt-1 border-0 bg-white" />
                                                    </div>
                                                    <div>
                                                        <Label htmlFor="owner-approval-deadline">Owner Approval Deadline</Label>
                                                        <Input id="owner-approval-deadline" type="datetime-local" value={ownerApprovalDeadlineAt} onChange={(event) => setOwnerApprovalDeadlineAt(event.target.value)} className="mt-1 border-0 bg-white" />
                                                    </div>
                                                </div>
                                            ) : null}
                                            {activeQueue === "AWAITING_ESTIMATE" && !ownerApprovalRejected ? (
                                                <div className="space-y-3 rounded-lg border border-[#aeb0c9]/15 bg-white px-3 py-3">
                                                    <p className="text-xs leading-5 text-[#5b5e74]">
                                                        {estimateActionMode === "workflow-submit"
                                                            ? "Management can submit a manual estimate here when the provider quote is delayed or unavailable."
                                                            : "Enter an estimate amount here only when management needs to take over the estimate workflow."}
                                                    </p>
                                                    {estimateActionMode === "workflow-submit" ? (
                                                        <Button className="h-9 w-full rounded-lg bg-[#0053dc] px-4 text-xs font-bold text-white hover:bg-[#0049c2]" onClick={() => void handleUploadEstimate()} disabled={!canAssign}>
                                                            Submit Estimate
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                            {ownerApprovalRejected ? <Banner title="Revise before continuing" body="Use Revise Estimate to update the amount and triage facts, then let the backend decide whether owner approval is still required." tone="danger" /> : null}
                                        </div>
                                    </DisclosureSection>

                                    {showFilesSection ? (
                                        <DisclosureSection title="Files" summary={`${attachments.length} file${attachments.length === 1 ? "" : "s"} available for preview and download.`} detailsRef={registerSection("attachments")} defaultOpen>
                                            <div className="space-y-2">
                                                {attachments.map((attachment) => (
                                                    <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg px-2 py-2 text-xs font-medium text-[#2e3145] transition hover:bg-zinc-50">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span className={attachment.contentType?.startsWith("image/") ? "text-amber-500" : "text-blue-500"}>
                                                                {attachment.contentType?.startsWith("image/") ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                            </span>
                                                            <span className="truncate">{attachment.fileName}</span>
                                                        </div>
                                                        <span className="text-[#5b5e74]">{formatFileSize(attachment.sizeBytes) ?? ""}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        </DisclosureSection>
                                    ) : null}

                                    {showMoreActions ? (
                                        <DisclosureSection title="More actions" summary="Admin, fallback, and override tools." detailsRef={registerSection("advanced")} tone="advanced">
                                    <div className="rounded-2xl border border-amber-200 bg-white/70 px-4 py-3 text-sm leading-6 text-amber-900">
                                        Use this area for exceptions and manual recovery. These controls are intentionally separated from the main decision flow.
                                    </div>
                                    <div className="grid gap-4">
                                        <SubsectionCard title="Edit triage inputs" description="Adjust the routing facts when the request classification changed." className="border-amber-200 bg-white/85">
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isEmergency} onChange={(event) => setIsEmergency(event.target.checked)} />Emergency</label>
                                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isLikeForLike} onChange={(event) => setIsLikeForLike(event.target.checked)} />Like for like</label>
                                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isUpgrade} onChange={(event) => setIsUpgrade(event.target.checked)} />Upgrade</label>
                                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isMajorReplacement} onChange={(event) => setIsMajorReplacement(event.target.checked)} />Major replacement</label>
                                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 sm:col-span-2"><input type="checkbox" checked={isResponsibilityDisputed} onChange={(event) => setIsResponsibilityDisputed(event.target.checked)} />Responsibility disputed</label>
                                            </div>
                                            <Button variant="outline" onClick={() => void handleSaveTriage()} disabled={!canAssign}>Save Triage</Button>
                                        </SubsectionCard>

                                        <SubsectionCard title="Owner approval exceptions" description="Keep owner-approval reasoning and privileged overrides out of the primary path." className="border-amber-200 bg-white/85">
                                            <div className="space-y-3">
                                                <div>
                                                    <Label htmlFor="approval-reason">Approval Request Reason</Label>
                                                    <Textarea id="approval-reason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Explain why owner approval is needed" className="min-h-24 bg-white" />
                                                </div>
                                                {canOverrideApproval ? (
                                                    <>
                                                        <div>
                                                            <Label>Override Source</Label>
                                                            <Select value={overrideDecisionSource} onValueChange={setOverrideDecisionSource}>
                                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="EMERGENCY_OVERRIDE">Emergency Override</SelectItem>
                                                                    <SelectItem value="MANAGEMENT_OVERRIDE">Management Override</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div>
                                                            <Label htmlFor="override-reason">Override Reason</Label>
                                                            <Textarea id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required for override" className="min-h-24 bg-white" />
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            onClick={() => void mutateGuard(
                                                                () => overrideReason.trim()
                                                                    ? overrideApproval.mutateAsync({ requestId: request.id, buildingId: requestBuildingId, payload: { decisionSource: overrideDecisionSource, ownerApprovalOverrideReason: overrideReason.trim() } })
                                                                    : Promise.reject(new Error("Override reason is required.")),
                                                                "Approval overridden",
                                                                "Failed to override approval"
                                                            )}
                                                            disabled={!canAssign}
                                                        >
                                                            Override Approval
                                                        </Button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </SubsectionCard>

                                        <SubsectionCard title="Execution fallback controls" description="Use only when the assigned actor cannot move the request forward directly." className="border-amber-200 bg-white/85">
                                            <div className="flex flex-wrap gap-2">
                                                {!ownerApprovalRejected && activeQueue === "ASSIGNED" ? <Button variant="outline" onClick={() => void mutateGuard(() => updateStatus.mutateAsync({ id: request.id, status: "in-progress", buildingId: requestBuildingId }), "Request force-started", "Failed to force start request")} disabled={!canUpdateStatus}>Force Start Work</Button> : null}
                                                {!ownerApprovalRejected && activeQueue === "IN_PROGRESS" ? <Button variant="outline" onClick={() => void mutateGuard(() => updateStatus.mutateAsync({ id: request.id, status: "completed", buildingId: requestBuildingId }), "Request force-completed", "Failed to force complete request")} disabled={!canUpdateStatus}>Force Complete</Button> : null}
                                                <Button variant="outline" onClick={() => adminAttachmentInputRef.current?.click()} disabled={!canComment && !canUpdateStatus}>Upload Admin Attachment</Button>
                                            </div>
                                            <input ref={adminAttachmentInputRef} type="file" multiple className="hidden" onChange={handleUploadAdminAttachments} />
                                        </SubsectionCard>

                                        <SubsectionCard title="Provider reassignment tools" description="Recover vendor-based workflows when the current provider is wrong or unresponsive." className="border-amber-200 bg-white/85">
                                            {request.queue === "AWAITING_ESTIMATE" || request.queue === "READY_TO_ASSIGN" ? (
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" onClick={() => void handleAssignProvider("Provider reassigned")} disabled={!canAssign}>Reassign Estimate Provider</Button>
                                                    {request.serviceProvider ? <Button variant="outline" onClick={() => void mutateGuard(() => unassignProvider.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Provider unassigned", "Failed to unassign provider")} disabled={!canAssign}>Unassign Provider</Button> : null}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-zinc-500">Provider reassignment tools appear only in estimate and ready-to-assign queues.</p>
                                            )}
                                        </SubsectionCard>

                                        <SubsectionCard title="Request controls" description="Final fallback controls that should stay separate from the main workflow." className="border-rose-200 bg-rose-50/60">
                                            <div className="flex flex-wrap gap-2">
                                                {ownerApprovalPending ? <Button variant="outline" onClick={() => void mutateGuard(() => sendReminder.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Reminder sent", "Failed to send reminder")} disabled={!canAssign}>{ownerReminderLabel}</Button> : null}
                                                <Button variant="destructive" onClick={() => void mutateGuard(() => cancelRequest.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Request canceled", "Failed to cancel request")} disabled={!canAssign}>Cancel Request</Button>
                                            </div>
                                        </SubsectionCard>
                                    </div>
                                        </DisclosureSection>
                                    ) : null}
                                </aside>
                        </div>
                    </section>
                </div>
                )}

                <Dialog open={isReviseEstimateOpen} onOpenChange={setIsReviseEstimateOpen}>
                    <DialogContent className="max-w-3xl border-zinc-200 bg-white p-0">
                        <div className="space-y-6 p-6">
                            <div className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Recovery flow</div>
                                <DialogTitle className="text-xl font-semibold text-zinc-950">Revise Estimate</DialogTitle>
                                <p className="text-sm leading-6 text-zinc-500">Update the estimate and triage facts, then submit again. The backend decides whether owner approval returns to pending or clears back to direct assignment.</p>
                            </div>

                            <Banner title="Owner rejected" body="The owner rejected this approval request. Revise the estimate or request details and submit again." tone="danger" />

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="revise-estimate-amount">Estimated Amount</Label>
                                    <Input id="revise-estimate-amount" value={estimatedAmount} onChange={(event) => setEstimatedAmount(event.target.value)} placeholder="450" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="revise-estimate-currency">Estimated Currency</Label>
                                    <Input id="revise-estimate-currency" value={estimatedCurrency} disabled placeholder="AED" />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="revise-deadline">Owner Approval Deadline</Label>
                                    <Input id="revise-deadline" type="datetime-local" value={ownerApprovalDeadlineAt} onChange={(event) => setOwnerApprovalDeadlineAt(event.target.value)} />
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isEmergency} onChange={(event) => setIsEmergency(event.target.checked)} />Emergency</label>
                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isLikeForLike} onChange={(event) => setIsLikeForLike(event.target.checked)} />Like for like</label>
                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isUpgrade} onChange={(event) => setIsUpgrade(event.target.checked)} />Upgrade</label>
                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"><input type="checkbox" checked={isMajorReplacement} onChange={(event) => setIsMajorReplacement(event.target.checked)} />Major replacement</label>
                                <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 sm:col-span-2"><input type="checkbox" checked={isResponsibilityDisputed} onChange={(event) => setIsResponsibilityDisputed(event.target.checked)} />Responsibility disputed</label>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="revise-approval-reason">Approval Required Reason</Label>
                                <Textarea id="revise-approval-reason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Optional context for why approval may still be required" className="min-h-24" />
                            </div>

                            <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsReviseEstimateOpen(false)}>Cancel</Button>
                                <Button onClick={() => void handleReviseEstimate()} disabled={!canAssign}>Submit Revised Estimate</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DialogContent>
        </Dialog>
    );
}
