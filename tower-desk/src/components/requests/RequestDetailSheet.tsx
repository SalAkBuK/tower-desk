"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarClock, ChevronDown, Loader2, MessageSquareText, Paperclip, Send, Sparkles } from "lucide-react";
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
    requestQueueStyles,
    statusLabels,
    statusStyles,
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
import type { RequestCommentVisibility, RequestQueue, ServiceRequest } from "@/lib/types";

interface RequestDetailSheetProps {
    requestId: string | null;
    buildingId?: string | null;
    buildingNameById?: Record<string, string>;
    onClose: () => void;
}

type SectionKey = "description" | "assignment" | "estimate" | "ownerApproval" | "policy" | "workflow" | "attachments" | "advanced";
type ActionDefinition = { key: string; label: string; onClick: () => void | Promise<unknown>; disabled?: boolean };

const MANAGEMENT_ROLES = new Set(["superadmin", "admin", "org_admin", "building_admin", "manager"]);

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
const formatCurrency = (amount?: string | null, currency?: string | null) => amount ? `${currency ? `${currency} ` : ""}${amount}` : "Not set";
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
const getSystemSummary = (request: ServiceRequest) => {
    if (request.policy?.summary?.trim()) return request.policy.summary.trim();
    switch (request.policy?.route) {
        case "DIRECT_ASSIGN": return "Direct assign recommended for a routine request.";
        case "EMERGENCY_DISPATCH": return "Emergency dispatch recommended. Proceed immediately and notify the owner.";
        case "NEEDS_ESTIMATE": return "Estimate required before dispatch due to unclear scope or likely cost.";
        case "OWNER_APPROVAL_REQUIRED": return "Owner approval required before execution due to policy threshold or scope.";
        default: return "Review the request and continue the workflow.";
    }
};

const Surface = ({ title, description, children, accent = "default" }: { title: string; description?: string; children: ReactNode; accent?: "default" | "hero" | "activity" }) => (
    <section
        className={[
            "overflow-hidden rounded-[28px] border shadow-sm",
            accent === "hero"
                ? "border-zinc-900/90 bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-800 text-white shadow-xl shadow-zinc-900/10"
                : accent === "activity"
                  ? "border-zinc-200 bg-linear-to-br from-white via-white to-zinc-50/80"
                  : "border-zinc-200 bg-white/95",
        ].join(" ")}
    >
        <div className={accent === "hero" ? "px-6 py-6 sm:px-7" : "px-5 py-5 sm:px-6"}>
            <div className="flex flex-col gap-1">
                <h3 className={accent === "hero" ? "text-sm font-semibold text-white/95" : "text-sm font-semibold text-zinc-950"}>{title}</h3>
                {description ? <p className={accent === "hero" ? "text-sm text-white/65" : "text-sm text-zinc-500"}>{description}</p> : null}
            </div>
            <div className="mt-5 space-y-4">{children}</div>
        </div>
    </section>
);

const DisclosureSection = ({ title, summary, detailsRef, children }: { title: string; summary: string; detailsRef?: (node: HTMLDetailsElement | null) => void; children: ReactNode }) => (
    <details ref={detailsRef} className="group overflow-hidden rounded-[24px] border border-zinc-200/90 bg-white/95 shadow-sm transition-colors open:border-zinc-300">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden sm:px-6">
            <div className="min-w-0">
                <div className="text-sm font-semibold text-zinc-950">{title}</div>
                <div className="mt-1 truncate pr-4 text-sm text-zinc-500">{summary}</div>
            </div>
            <div className="flex items-center gap-3 text-zinc-400">
                <span className="hidden text-[11px] font-medium uppercase tracking-[0.18em] sm:inline">Details</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 transition-transform group-open:rotate-180">
                    <ChevronDown className="h-4 w-4" />
                </div>
            </div>
        </summary>
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4 sm:px-6">
            <div className="space-y-4">{children}</div>
        </div>
    </details>
);

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="grid gap-1 rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 sm:grid-cols-[168px_minmax(0,1fr)] sm:items-start">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
        <div className="text-sm text-zinc-700">{value}</div>
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
    const [estimatedAmount, setEstimatedAmount] = useState("");
    const [estimatedCurrency, setEstimatedCurrency] = useState("");
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

    useEffect(() => {
        setSelectedStaffUserId(request?.assignedEmployeeId ?? "");
        setSelectedServiceProviderId(request?.serviceProvider?.id ?? "");
        setEstimatedAmount(request?.ownerApproval?.estimatedAmount ?? "");
        setEstimatedCurrency(request?.ownerApproval?.estimatedCurrency ?? "");
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
    const registerSection = (section: SectionKey) => (node: HTMLDetailsElement | null) => { sectionRefs.current[section] = node; };

    const activeQueue = getDisplayQueue(request);
    const isOverdue = request?.queue === "OVERDUE";
    const ownerApprovalStatus = request?.ownerApproval?.status ?? request?.ownerApprovalStatus ?? "NOT_REQUIRED";
    const estimateStatus = request?.estimate?.status ?? "NOT_REQUESTED";
    const ownerApprovalPending = ownerApprovalStatus === "PENDING";
    const ownerApprovalRejected = ownerApprovalStatus === "REJECTED";
    const estimateRequested = estimateStatus === "REQUESTED" || activeQueue === "AWAITING_ESTIMATE";
    const visibleComments = (request?.comments ?? []).filter((comment) => canSeeInternalComments || comment.visibility !== "INTERNAL");
    const attachments = request?.attachments ?? [];
    const latestComment = visibleComments.at(-1) ?? null;
    const collapsedCommentCount = Math.max(visibleComments.length - 2, 0);
    const commentsToRender = showAllComments ? visibleComments : visibleComments.slice(-2);
    const buildingName = request ? buildingNameById?.[request.buildingId] ?? request.buildingName ?? request.buildingId : buildingId ?? "";
    const unitLine = request?.unit?.label ?? request?.unit?.id ?? "No unit";
    const unitMeta = typeof request?.unit?.floor === "number" ? `${unitLine} | Floor ${request.unit.floor}` : unitLine;
    const routeLabel = request?.policy?.route ? policyRouteLabels[request.policy.route as keyof typeof policyRouteLabels] ?? request.policy.route : "Pending";
    const recommendationLabel = request?.policy?.recommendation ? recommendationLabels[request.policy.recommendation as keyof typeof recommendationLabels] ?? request.policy.recommendation : "Pending";
    const recommendationClass = request?.policy?.recommendation ? recommendationStyles[request.policy.recommendation as keyof typeof recommendationStyles] ?? "border-zinc-200 bg-zinc-100 text-zinc-700" : "border-zinc-200 bg-zinc-100 text-zinc-700";
    const queueLabel = activeQueue ? requestQueueLabels[activeQueue] ?? activeQueue : "No queue";
    const queueClass = activeQueue ? requestQueueStyles[activeQueue] ?? "" : "";
    const ownerApprovalLabel = ownerApprovalStatusLabels[ownerApprovalStatus as keyof typeof ownerApprovalStatusLabels] ?? ownerApprovalStatus;
    const ownerApprovalClass = ownerApprovalStatusStyles[ownerApprovalStatus as keyof typeof ownerApprovalStatusStyles] ?? "";
    const estimateLabel = estimateStatusLabels[estimateStatus as keyof typeof estimateStatusLabels] ?? estimateStatus;
    const estimateClass = estimateStatusStyles[estimateStatus as keyof typeof estimateStatusStyles] ?? "";
    const statusLabel = request ? statusLabels[request.status] ?? request.status : "";
    const statusClass = request ? statusStyles[request.status] ?? "" : "";
    const shouldShowStatusBadge = Boolean(statusLabel) && statusLabel !== queueLabel;
    const systemSummary = request ? getSystemSummary(request) : "";
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
    const handleReassign = async () => {
        if (!request) return;
        if (request.serviceProvider) return openSection("assignment");
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
            openSection("estimate");
            toast.error("Select a provider or enter an estimate amount first.");
            return;
        }
        await mutateGuard(() => requestEstimate.mutateAsync({ requestId, buildingId: requestBuildingId, serviceProviderId: providerId }), "Estimate requested", "Failed to request estimate");
    };
    const handleUploadEstimate = async () => {
        if (!estimatedAmount.trim()) {
            openSection("estimate");
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
            () => saveTriage.mutateAsync({ requestId: request.id, buildingId: requestBuildingId, payload: { estimatedAmount: payload.estimatedAmount, estimatedCurrency: payload.estimatedCurrency, isEmergency, isLikeForLike, isUpgrade, isMajorReplacement, isResponsibilityDisputed } }),
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
        if (request.queue === "NEW" && request.policy?.route === "EMERGENCY_DISPATCH") return { key: "dispatch-now", label: "Dispatch Now", onClick: async () => { if (selectedStaffUserId) return handleAssignStaff(); if (selectedServiceProviderId || request.serviceProvider?.id) return handleAssignProvider(); openSection("assignment"); }, disabled: !canAssign };
        if (request.queue === "NEW" && request.policy?.route === "NEEDS_ESTIMATE") return { key: "request-estimate", label: "Request Estimate", onClick: handleRequestOrUploadEstimate, disabled: !canAssign };
        if (request.queue === "NEW" && request.policy?.route === "OWNER_APPROVAL_REQUIRED") return { key: "request-owner-approval", label: "Request Owner Approval", onClick: handleRequestOwnerApproval, disabled: !canAssign };
        if (activeQueue === "NEEDS_ESTIMATE") return { key: "request-estimate", label: "Request Estimate", onClick: handleRequestOrUploadEstimate, disabled: !canAssign };
        if (activeQueue === "AWAITING_ESTIMATE") return { key: "follow-up-estimate", label: "Follow Up Estimate", onClick: () => setCommentText((draft) => draft || "Following up on the requested estimate."), disabled: !canComment };
        if (activeQueue === "AWAITING_OWNER") return { key: "waiting-owner", label: "Waiting for Owner", onClick: () => void 0, disabled: true };
        if (activeQueue === "READY_TO_ASSIGN") return { key: "assign-staff", label: "Assign Staff", onClick: handleAssignStaff, disabled: !canAssign };
        if (activeQueue === "ASSIGNED") return { key: "follow-up-assigned", label: isOverdue ? "Escalate Follow Up" : "Follow Up", onClick: () => setCommentText((draft) => draft || "Following up with the assigned team."), disabled: !canComment };
        if (activeQueue === "IN_PROGRESS") return { key: "review-progress", label: isOverdue ? "Escalate Progress Review" : "Review Progress", onClick: () => setCommentText((draft) => draft || "Please share a progress update."), disabled: !canComment };
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
        if (activeQueue === "READY_TO_ASSIGN") {
            secondaryActions.push({ key: "assign-provider", label: "Assign Provider", onClick: () => handleAssignProvider(), disabled: !canAssign });
        }
        if (activeQueue === "ASSIGNED") {
            secondaryActions.push({ key: "reassign", label: "Reassign", onClick: handleReassign, disabled: !canAssign });
            secondaryActions.push({ key: "add-comment", label: "Add Comment", onClick: () => setCommentText((draft) => draft || "Coordination update."), disabled: !canComment });
        }
        if (activeQueue === "IN_PROGRESS") {
            secondaryActions.push({ key: "follow-up", label: "Follow Up", onClick: () => setCommentText((draft) => draft || "Please share a progress update."), disabled: !canComment });
            secondaryActions.push({ key: "add-comment", label: "Add Comment", onClick: () => setCommentText((draft) => draft || "Progress update."), disabled: !canComment });
        }
        }
    }

    const visibleSecondaryActions = secondaryActions.slice(0, 2);
    const shouldShowOwnerBadge = ownerApprovalStatus !== "NOT_REQUIRED";
    const shouldShowEstimateBadge = estimateStatus !== "NOT_REQUESTED" || activeQueue === "NEEDS_ESTIMATE" || activeQueue === "AWAITING_ESTIMATE";
    const ownerApprovalSummary = shouldShowOwnerBadge ? `${ownerApprovalLabel}${request?.ownerApproval?.deadlineAt && ownerApprovalPending ? ` | Deadline ${formatDateTime(request.ownerApproval.deadlineAt)}` : request?.ownerApproval?.decidedAt && ownerApprovalRejected ? ` | Decided ${formatDateTime(request.ownerApproval.decidedAt)}` : ""}` : null;
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

    if (!requestId) return null;

    return (
        <Dialog open={!!requestId} onOpenChange={(open) => !open && onClose()} modal={false}>
            <DialogContent className="flex h-[94vh] w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden border-zinc-200 bg-zinc-100/90 p-0 shadow-2xl sm:max-w-[calc(100vw-2rem)] 2xl:max-w-[1680px]">
                <DialogTitle className="sr-only">Request details</DialogTitle>
                {isLoading ? (
                    <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-zinc-400" /></div>
                ) : !request ? (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-500">Request not found.</div>
                ) : (
                    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(244,244,245,0.96)_42%,_rgba(228,228,231,0.95)_100%)] p-4 sm:p-6">
                        <div className="space-y-6">
                            <Surface title="Request overview" description="The current queue and next action stay above the fold." accent="hero">
                                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_360px]">
                                    <div className="space-y-5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {activeQueue ? <Badge data-request-badge="queue" variant="outline" className={`border-white/20 bg-white/10 text-white ${queueClass}`}>{queueLabel}</Badge> : null}
                                            {shouldShowStatusBadge ? <Badge data-request-badge="status" variant="outline" className={`border-white/20 bg-white/10 text-white ${statusClass}`}>{statusLabel}</Badge> : null}
                                            {shouldShowOwnerBadge ? <Badge variant="outline" className={`border-white/20 bg-white/10 text-white ${ownerApprovalClass}`}>{ownerApprovalLabel}</Badge> : null}
                                            {shouldShowEstimateBadge ? <Badge variant="outline" className={`border-white/20 bg-white/10 text-white ${estimateClass}`}>{estimateLabel}</Badge> : null}
                                            {isOverdue ? <Badge variant="outline" className="border-rose-300/40 bg-rose-400/15 text-rose-100">Overdue</Badge> : null}
                                        </div>
                                        <div>
                                            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{request.title}</h2>
                                            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">{systemSummary}</p>
                                        </div>
                                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                                                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                                                    <Building2 className="h-3.5 w-3.5" />
                                                    Building
                                                </div>
                                                <div className="mt-2 text-base font-medium leading-6 text-white/90">{buildingName}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4">
                                                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">Unit</div>
                                                <div className="mt-2 text-base font-medium leading-6 text-white/90">{unitMeta}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-4 md:col-span-2 2xl:col-span-1">
                                                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
                                                    <CalendarClock className="h-3.5 w-3.5" />
                                                    Created
                                                </div>
                                                <div className="mt-2 text-base font-medium leading-6 text-white/90">{formatDateTime(request.createdAt)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex w-full flex-col gap-3 xl:items-stretch">
                                        <div className="rounded-[24px] border border-white/10 bg-white/8 p-5 backdrop-blur-sm">
                                            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">Next action</div>
                                            <div className="mt-2 text-lg font-semibold text-white">{primaryAction?.label ?? "No workflow action available"}</div>
                                            <div className="mt-1 text-sm leading-6 text-white/60">
                                                {visibleSecondaryActions.length > 0 ? "Secondary tools stay available below the main path." : "No secondary workflow action is needed right now."}
                                            </div>
                                            <div className="mt-5 flex flex-col gap-2.5">
                                                {primaryAction ? <Button className="h-11 w-full border-white/20 bg-white text-zinc-950 hover:bg-white/90" onClick={() => void primaryAction.onClick()} disabled={Boolean(primaryAction.disabled)}>{primaryAction.label}</Button> : null}
                                                {visibleSecondaryActions.map((action) => <Button key={action.key} variant="outline" className="h-11 w-full border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void action.onClick()} disabled={Boolean(action.disabled)}>{action.label}</Button>)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Surface>

                            <Surface title="System decision" description="Plain-language guidance from the current route and queue.">
                                <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                                    <div className="space-y-4 rounded-[24px] border border-zinc-200 bg-zinc-50/80 p-5">
                                        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Decision signal
                                        </div>
                                        <div className="space-y-3">
                                            <div className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">{routeLabel}</div>
                                            <div className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${recommendationClass}`}>{recommendationLabel}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-4 rounded-[24px] border border-zinc-200 bg-white p-5">
                                        <p className="max-w-4xl text-[15px] leading-7 text-zinc-700">{systemSummary}</p>
                                        <div className="grid gap-3 lg:grid-cols-2">
                                            {ownerApprovalRecoverySummary ? <div className="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm leading-6 text-rose-900"><div className="font-semibold">Owner Rejected</div><div>{ownerApprovalRecoverySummary}</div></div> : null}
                                            {estimateSummary ? <div className="rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3 text-sm leading-6 text-teal-900">Estimate workflow: {estimateSummary}</div> : null}
                                            {ownerApprovalSummary ? <div className="rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">Owner approval: {ownerApprovalSummary}</div> : null}
                                        </div>
                                        {blockMessage ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium leading-6 text-amber-900">{blockMessage}</div> : null}
                                    </div>
                                </div>
                            </Surface>

                            <Surface title="Activity" description={latestComment ? `Latest update from ${latestComment.user?.fullName ?? latestComment.user?.email ?? "management"} at ${formatDateTime(latestComment.createdAt)}.` : "Comments and attachments stay easy to reach."} accent="activity">
                                <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                                    <div className="space-y-4 rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100"><Paperclip className="h-4 w-4 text-zinc-600" /></div>
                                            <div>
                                                <div className="text-sm font-semibold text-zinc-950">Attachments preview</div>
                                                <div className="text-xs text-zinc-500">{attachments.length === 0 ? "No files uploaded yet." : `${attachments.length} file${attachments.length === 1 ? "" : "s"} attached.`}</div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {attachments.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">No attachments yet.</div> : attachments.slice(0, 3).map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-800 transition hover:border-zinc-300 hover:bg-white hover:text-blue-700">{attachment.fileName}</a>)}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="mb-4 flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100"><MessageSquareText className="h-4 w-4 text-zinc-600" /></div>
                                                <div>
                                                    <div className="text-sm font-semibold text-zinc-950">Comments</div>
                                                    <div className="text-xs text-zinc-500">{visibleComments.length === 0 ? "No discussion yet." : `${visibleComments.length} update${visibleComments.length === 1 ? "" : "s"} in this thread.`}</div>
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                            {visibleComments.length === 0 ? <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">No comments yet.</div> : commentsToRender.map((comment) => (
                                                <div key={comment.id} className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                                        <div className="text-sm font-medium text-zinc-950">{comment.user?.fullName ?? comment.user?.email ?? "User"}</div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className={comment.visibility === "INTERNAL" ? "border-zinc-300 bg-zinc-100 text-zinc-700" : "border-sky-200 bg-sky-50 text-sky-700"}>{comment.visibility ?? "SHARED"}</Badge>
                                                            <span className="text-xs text-zinc-400">{formatDateTime(comment.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">{comment.commentText}</p>
                                                </div>
                                            ))}
                                            {!showAllComments && collapsedCommentCount > 0 ? (
                                                <Button variant="outline" className="w-full rounded-2xl" onClick={() => setShowAllComments(true)}>
                                                    Show {collapsedCommentCount} older comment{collapsedCommentCount === 1 ? "" : "s"}
                                                </Button>
                                            ) : null}
                                            {showAllComments && collapsedCommentCount > 0 ? (
                                                <Button variant="ghost" className="w-full rounded-2xl" onClick={() => setShowAllComments(false)}>
                                                    Show fewer comments
                                                </Button>
                                            ) : null}
                                            </div>
                                        </div>
                                        <div className="rounded-[24px] border border-zinc-200 bg-white p-5 shadow-sm">
                                            <div className="space-y-3">
                                                {canSeeInternalComments ? <div><Label>Visibility</Label><Select value={commentVisibility} onValueChange={(value) => setCommentVisibility(value as RequestCommentVisibility)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SHARED">Shared</SelectItem><SelectItem value="INTERNAL">Internal</SelectItem></SelectContent></Select></div> : null}
                                                <Textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add a workflow update" className="min-h-24" />
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Button className="rounded-full" onClick={() => void handlePostComment()} disabled={!canComment || !commentText.trim()}><Send className="mr-2 h-4 w-4" />Post Comment</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Surface>

                            <DisclosureSection title="Description" summary={request.description ? request.description.slice(0, 110) : "No description provided."} detailsRef={registerSection("description")}>
                                <Field label="Description" value={<span className="whitespace-pre-wrap">{request.description || "No description"}</span>} />
                                <Field label="Created By" value={request.createdBy?.name ?? request.createdBy?.fullName ?? request.createdBy?.email ?? request.createdByTenantId} />
                                <Field label="Unit" value={unitMeta} />
                            </DisclosureSection>

                            <DisclosureSection title="Assignment" summary={`Staff: ${request.assignedTo?.fullName ?? request.assignedTo?.email ?? "Unassigned"} | Provider: ${request.serviceProvider?.name ?? "Unassigned"} | Worker: ${request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email ?? "Unassigned"}`} detailsRef={registerSection("assignment")}>
                                <Field label="Staff Assignee" value={request.assignedTo?.fullName ?? request.assignedTo?.email ?? "Unassigned"} />
                                <Field label="Provider" value={request.serviceProvider?.name ?? "Unassigned"} />
                                <Field label="Provider Worker" value={request.serviceProviderAssignedTo?.name ?? request.serviceProviderAssignedTo?.email ?? "Unassigned"} />
                                {ownerApprovalRejected ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Assignment stays blocked until the estimate is revised and resubmitted.</div> : null}
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                                        <div>
                                            <Label>Assign Staff</Label>
                                            <Select value={selectedStaffUserId || "__none__"} onValueChange={(value) => setSelectedStaffUserId(value === "__none__" ? "" : value)}>
                                                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Unassigned</SelectItem>
                                                    {employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.fullName ?? employee.name ?? employee.email}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={() => void handleAssignStaff()} disabled={!canAssign || ownerApprovalRejected || !selectedStaffUserId}>
                                                {request.assignedEmployeeId ? "Reassign Staff" : "Assign Staff"}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4">
                                        <div>
                                            <Label>Assign Provider</Label>
                                            <Select value={selectedServiceProviderId || "__none__"} onValueChange={(value) => setSelectedServiceProviderId(value === "__none__" ? "" : value)}>
                                                <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">Unassigned</SelectItem>
                                                    {availableProviders.map((provider) => <SelectItem key={provider.id} value={provider.id}>{provider.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" onClick={() => void handleAssignProvider(request.serviceProvider ? "Provider reassigned" : "Provider assigned")} disabled={!canAssign || ownerApprovalRejected || !selectedServiceProviderId}>
                                                {request.serviceProvider ? "Reassign Provider" : "Assign Provider"}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </DisclosureSection>

                            <DisclosureSection title="Estimate Details" summary={estimateSummary ?? "No estimate workflow is active."} detailsRef={registerSection("estimate")}>
                                <Field label="Estimate Status" value={<Badge variant="outline" className={estimateClass}>{estimateLabel}</Badge>} />
                                <Field label="Requested At" value={formatDateTime(request.estimate?.requestedAt)} />
                                <Field label="Requested By" value={request.estimate?.requestedByUserId ?? "N/A"} />
                                <Field label="Due At" value={formatDateTime(request.estimate?.dueAt)} />
                                <Field label="Reminder Sent" value={formatDateTime(request.estimate?.reminderSentAt)} />
                                <Field label="Submitted At" value={formatDateTime(request.estimate?.submittedAt)} />
                                <Field label="Submitted By" value={request.estimate?.submittedByUserId ?? "N/A"} />
                                {ownerApprovalRejected ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">Use Revise Estimate to update the amount and triage facts, then let the backend decide whether owner approval is still required.</div> : null}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div><Label htmlFor="estimate-amount">Estimated Amount</Label><Input id="estimate-amount" value={estimatedAmount} onChange={(event) => setEstimatedAmount(event.target.value)} placeholder="450" /></div>
                                    <div><Label htmlFor="estimate-currency">Estimated Currency</Label><Input id="estimate-currency" value={estimatedCurrency} onChange={(event) => setEstimatedCurrency(event.target.value.toUpperCase())} placeholder="AED" /></div>
                                </div>
                            </DisclosureSection>

                            <DisclosureSection title="Owner Approval Details" summary={ownerApprovalSummary ?? "Owner approval is not active on this request."} detailsRef={registerSection("ownerApproval")}>
                                <Field label="Status" value={<Badge variant="outline" className={ownerApprovalClass}>{ownerApprovalLabel}</Badge>} />
                                <Field label="Required Reason" value={request.ownerApproval?.requiredReason ?? "Not set"} />
                                <Field label="Estimated Amount" value={formatCurrency(request.ownerApproval?.estimatedAmount, request.ownerApproval?.estimatedCurrency)} />
                                <Field label="Requested At" value={formatDateTime(request.ownerApproval?.requestedAt)} />
                                <Field label="Requested By" value={request.ownerApproval?.requestedByUserId ?? "N/A"} />
                                <Field label="Deadline" value={formatDateTime(request.ownerApproval?.deadlineAt)} />
                                <Field label="Decided At" value={formatDateTime(request.ownerApproval?.decidedAt)} />
                                <Field label="Reason" value={request.ownerApproval?.reason ?? "N/A"} />
                                <Field label="Decision Source" value={request.ownerApproval?.decisionSource ?? "N/A"} />
                                <Field label="Override Reason" value={request.ownerApproval?.overrideReason ?? "N/A"} />
                                <Field label="Overridden By" value={request.ownerApproval?.overriddenByUserId ?? "N/A"} />
                            </DisclosureSection>

                            <DisclosureSection title="Policy Details" summary={`${routeLabel} | ${recommendationLabel}`} detailsRef={registerSection("policy")}>
                                <Field label="Route" value={routeLabel} />
                                <Field label="Recommendation" value={<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${recommendationClass}`}>{recommendationLabel}</span>} />
                                <Field label="Summary" value={request.policy?.summary ?? "No summary"} />
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Emergency" value={formatBoolean(request.policy?.isEmergency ?? request.isEmergency)} />
                                    <Field label="Like for Like" value={formatBoolean(request.policy?.isLikeForLike ?? request.isLikeForLike)} />
                                    <Field label="Upgrade" value={formatBoolean(request.policy?.isUpgrade ?? request.isUpgrade)} />
                                    <Field label="Major Replacement" value={formatBoolean(request.policy?.isMajorReplacement ?? request.isMajorReplacement)} />
                                    <Field label="Responsibility Disputed" value={formatBoolean(request.policy?.isResponsibilityDisputed ?? request.isResponsibilityDisputed)} />
                                </div>
                            </DisclosureSection>

                            <DisclosureSection title="Workflow Snapshot" summary={`${queueLabel} | ${statusLabel}`} detailsRef={registerSection("workflow")}>
                                <Field label="Queue" value={queueLabel} />
                                <Field label="Status" value={statusLabel} />
                                <Field label="Route" value={routeLabel} />
                                <Field label="Recommendation" value={recommendationLabel} />
                            </DisclosureSection>

                            <DisclosureSection title="Full Attachments" summary={attachments.length === 0 ? "No attachments uploaded." : `${attachments.length} file${attachments.length === 1 ? "" : "s"} attached.`} detailsRef={registerSection("attachments")}>
                                {attachments.length === 0 ? <div className="text-sm text-zinc-500">No attachments yet.</div> : <div className="space-y-2">{attachments.map((attachment) => <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-blue-700 underline-offset-2 hover:underline">{attachment.fileName}</a>)}</div>}
                            </DisclosureSection>

                            <DisclosureSection title="Advanced Actions" summary="Fallback management controls for exceptions, overrides, and admin-only intervention." detailsRef={registerSection("advanced")}>
                                <div className="grid gap-6 xl:grid-cols-2">
                                    <div className="space-y-4">
                                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-sm font-semibold text-zinc-950">Edit triage inputs</div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={isEmergency} onChange={(event) => setIsEmergency(event.target.checked)} />Emergency</label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={isLikeForLike} onChange={(event) => setIsLikeForLike(event.target.checked)} />Like for like</label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={isUpgrade} onChange={(event) => setIsUpgrade(event.target.checked)} />Upgrade</label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={isMajorReplacement} onChange={(event) => setIsMajorReplacement(event.target.checked)} />Major replacement</label>
                                                <label className="flex items-center gap-2 text-sm text-zinc-700"><input type="checkbox" checked={isResponsibilityDisputed} onChange={(event) => setIsResponsibilityDisputed(event.target.checked)} />Responsibility disputed</label>
                                            </div>
                                            <Button variant="outline" onClick={() => void handleSaveTriage()} disabled={!canAssign}>Save Triage</Button>
                                        </div>
                                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-sm font-semibold text-zinc-950">Owner approval exceptions</div>
                                            <div><Label htmlFor="approval-reason">Approval Request Reason</Label><Textarea id="approval-reason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} placeholder="Explain why owner approval is needed" className="min-h-20" /></div>
                                            {canOverrideApproval ? <>
                                                <div><Label>Override Source</Label><Select value={overrideDecisionSource} onValueChange={setOverrideDecisionSource}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EMERGENCY_OVERRIDE">Emergency Override</SelectItem><SelectItem value="MANAGEMENT_OVERRIDE">Management Override</SelectItem></SelectContent></Select></div>
                                                <div><Label htmlFor="override-reason">Override Reason</Label><Textarea id="override-reason" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required for override" className="min-h-20" /></div>
                                                <Button variant="outline" onClick={() => void mutateGuard(() => overrideReason.trim() ? overrideApproval.mutateAsync({ requestId: request.id, buildingId: requestBuildingId, payload: { decisionSource: overrideDecisionSource, ownerApprovalOverrideReason: overrideReason.trim() } }) : Promise.reject(new Error("Override reason is required.")), "Approval overridden", "Failed to override approval")} disabled={!canAssign}>Override Approval</Button>
                                            </> : null}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-sm font-semibold text-zinc-950">Execution fallback controls</div>
                                            <p className="text-xs leading-5 text-zinc-500">Use only when the assigned actor cannot update the request directly. These actions override the normal worker-owned lifecycle.</p>
                                            <div className="flex flex-wrap gap-2">
                                                {activeQueue === "AWAITING_ESTIMATE" ? <Button variant="outline" onClick={() => void handleUploadEstimate()} disabled={!canAssign}>Submit Estimate Fallback</Button> : null}
                                                {!ownerApprovalRejected && activeQueue === "ASSIGNED" ? <Button variant="outline" onClick={() => void mutateGuard(() => updateStatus.mutateAsync({ id: request.id, status: "in-progress", buildingId: requestBuildingId }), "Request force-started", "Failed to force start request")} disabled={!canUpdateStatus}>Force Start Work</Button> : null}
                                                {!ownerApprovalRejected && activeQueue === "IN_PROGRESS" ? <Button variant="outline" onClick={() => void mutateGuard(() => updateStatus.mutateAsync({ id: request.id, status: "completed", buildingId: requestBuildingId }), "Request force-completed", "Failed to force complete request")} disabled={!canUpdateStatus}>Force Complete</Button> : null}
                                                <Button variant="outline" onClick={() => adminAttachmentInputRef.current?.click()} disabled={!canComment && !canUpdateStatus}>Upload Admin Attachment</Button>
                                            </div>
                                            <input ref={adminAttachmentInputRef} type="file" multiple className="hidden" onChange={handleUploadAdminAttachments} />
                                        </div>
                                        {request.queue === "AWAITING_ESTIMATE" || request.queue === "READY_TO_ASSIGN" ? (
                                            <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                                <div className="text-sm font-semibold text-zinc-950">Provider reassignment tools</div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" onClick={() => void handleAssignProvider("Provider reassigned")} disabled={!canAssign}>Reassign Estimate Provider</Button>
                                                    {request.serviceProvider ? <Button variant="outline" onClick={() => void mutateGuard(() => unassignProvider.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Provider unassigned", "Failed to unassign provider")} disabled={!canAssign}>Unassign Provider</Button> : null}
                                                </div>
                                            </div>
                                        ) : null}
                                        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                            <div className="text-sm font-semibold text-zinc-950">Request controls</div>
                                            <div className="flex flex-wrap gap-2">
                                                {ownerApprovalPending ? <Button variant="outline" onClick={() => void mutateGuard(() => sendReminder.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Reminder sent", "Failed to send reminder")} disabled={!canAssign}>{ownerReminderLabel}</Button> : null}
                                                <Button variant="ghost" onClick={() => void mutateGuard(() => cancelRequest.mutateAsync({ requestId: request.id, buildingId: requestBuildingId }), "Request canceled", "Failed to cancel request")} disabled={!canAssign}>Cancel Request</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </DisclosureSection>
                        </div>
                    </div>
                )}
                <Dialog open={isReviseEstimateOpen} onOpenChange={setIsReviseEstimateOpen}>
                    <DialogContent className="max-w-3xl border-zinc-200 bg-white p-0">
                        <div className="space-y-6 p-6">
                            <div className="space-y-2">
                                <DialogTitle className="text-xl font-semibold text-zinc-950">Revise Estimate</DialogTitle>
                                <p className="text-sm leading-6 text-zinc-500">Update the estimate and triage facts, then submit again. The backend will decide whether owner approval returns to pending or clears back to direct assignment.</p>
                            </div>

                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                                <div className="font-semibold">Owner Rejected</div>
                                <div>The owner rejected this approval request. Revise the estimate or request details and submit again.</div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="revise-estimate-amount">Estimated Amount</Label>
                                    <Input id="revise-estimate-amount" value={estimatedAmount} onChange={(event) => setEstimatedAmount(event.target.value)} placeholder="450" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="revise-estimate-currency">Estimated Currency</Label>
                                    <Input id="revise-estimate-currency" value={estimatedCurrency} onChange={(event) => setEstimatedCurrency(event.target.value.toUpperCase())} placeholder="AED" />
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
