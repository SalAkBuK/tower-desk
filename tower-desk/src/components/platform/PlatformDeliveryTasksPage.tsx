"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    Inbox,
    Loader2,
    RefreshCcw,
    Search,
    ShieldAlert,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { listDeliveryTasks } from "@/lib/api/platform";
import type {
    CleanupDeliveryTasksBody,
    CleanupDeliveryTaskStatus,
    DeliveryTask,
    DeliveryTaskKind,
    DeliveryTaskListResponse,
    DeliveryTaskStatus,
    ListDeliveryTasksQuery,
} from "@/lib/deliveryTasks";
import {
    CLEANUP_DELIVERY_TASK_STATUSES,
    DELIVERY_TASK_KINDS,
    DELIVERY_TASK_STATUSES,
} from "@/lib/deliveryTasks";
import { getUserPermissionSet, hasPermission } from "@/lib/permissions";
import {
    getDeliveryTaskSummaryQueryKey,
    getDeliveryTasksQueryKey,
    useCleanupDeliveryTasks,
    useDeliveryTask,
    useDeliveryTaskSummary,
    useDeliveryTasks,
    useRetryDeliveryTask,
    useRetryFailedDeliveryTasks,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

type FilterState = {
    kind: DeliveryTaskKind | "ALL";
    status: DeliveryTaskStatus | "ALL";
    orgId: string;
    referenceType: string;
    referenceId: string;
    lastErrorContains: string;
    limit: number;
};

type CleanupState = {
    olderThanDays: string;
    dryRun: boolean;
    statuses: CleanupDeliveryTaskStatus[];
};

const DEFAULT_FILTERS: FilterState = {
    kind: "ALL",
    status: "ALL",
    orgId: "",
    referenceType: "",
    referenceId: "",
    lastErrorContains: "",
    limit: 20,
};

const DEFAULT_CLEANUP: CleanupState = {
    olderThanDays: "30",
    dryRun: true,
    statuses: [...CLEANUP_DELIVERY_TASK_STATUSES],
};

const STATUS_LABELS: Record<DeliveryTaskStatus, string> = {
    QUEUED: "Queued",
    PROCESSING: "Processing",
    SUCCEEDED: "Succeeded",
    FAILED: "Failed",
    RETRIED: "Retried",
};

const KIND_LABELS: Record<DeliveryTaskKind, string> = {
    AUTH_PASSWORD_EMAIL: "Password email",
    PUSH_NOTIFICATION: "Push notification",
    BROADCAST_FANOUT: "Broadcast fanout",
};

const LIMIT_OPTIONS = [20, 50, 100];

const clampLimit = (value: number) => Math.max(1, Math.min(100, Number.isFinite(value) ? Math.trunc(value) : 20));

const formatDateTime = (value?: string | null) => {
    if (!value) return "-";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const truncateText = (value?: string | null, max = 140) => {
    const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
    if (!normalized) return "-";
    return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
};

const formatJson = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const getStatusTone = (status: DeliveryTaskStatus) => {
    switch (status) {
        case "FAILED":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "SUCCEEDED":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "PROCESSING":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "RETRIED":
            return "border-sky-200 bg-sky-50 text-sky-700";
        case "QUEUED":
        default:
            return "border-zinc-200 bg-zinc-50 text-zinc-700";
    }
};

const buildListQuery = (filters: FilterState, cursor?: string | null): ListDeliveryTasksQuery => ({
    kind: filters.kind === "ALL" ? undefined : filters.kind,
    status: filters.status === "ALL" ? undefined : filters.status,
    orgId: filters.orgId.trim() || undefined,
    referenceType: filters.referenceType.trim() || undefined,
    referenceId: filters.referenceId.trim() || undefined,
    lastErrorContains: filters.lastErrorContains.trim() || undefined,
    cursor: cursor || undefined,
    limit: clampLimit(filters.limit),
});

const buildSummaryQuery = (filters: FilterState): Omit<ListDeliveryTasksQuery, "cursor" | "limit"> => {
    const { cursor: _cursor, limit: _limit, ...query } = buildListQuery(filters);
    return query;
};

const buildRetryFailedBody = (filters: FilterState) => ({
    kind: filters.kind === "ALL" ? undefined : filters.kind,
    orgId: filters.orgId.trim() || undefined,
    referenceType: filters.referenceType.trim() || undefined,
    referenceId: filters.referenceId.trim() || undefined,
    lastErrorContains: filters.lastErrorContains.trim() || undefined,
    limit: clampLimit(filters.limit),
});

const buildCleanupBody = (state: CleanupState): CleanupDeliveryTasksBody => ({
    olderThanDays: Math.max(1, Number.parseInt(state.olderThanDays || "30", 10) || 30),
    statuses: state.statuses,
    dryRun: state.dryRun,
});

const mergeTasks = (current: DeliveryTask[] = [], incoming: DeliveryTask[] = []) => {
    const map = new Map<string, DeliveryTask>();
    [...current, ...incoming].forEach((task) => map.set(task.id, task));
    return Array.from(map.values());
};

const describeScope = (filters: FilterState) => {
    const parts = [
        filters.status !== "ALL" ? `status ${STATUS_LABELS[filters.status]}` : null,
        filters.kind !== "ALL" ? `kind ${KIND_LABELS[filters.kind]}` : null,
        filters.orgId.trim() ? `org ${filters.orgId.trim()}` : null,
        filters.referenceType.trim() ? `reference type ${filters.referenceType.trim()}` : null,
        filters.referenceId.trim() ? `reference ${filters.referenceId.trim()}` : null,
        filters.lastErrorContains.trim() ? `error contains "${filters.lastErrorContains.trim()}"` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "all delivery tasks";
};

export function PlatformDeliveryTasksPage() {
    const { user } = useAuth();
    const permissionSet = useMemo(() => getUserPermissionSet(user), [user]);
    const canRead = hasPermission(permissionSet, "platform.delivery_tasks.read");
    const canRetry = hasPermission(permissionSet, "platform.delivery_tasks.retry");
    const canCleanup = hasPermission(permissionSet, "platform.delivery_tasks.cleanup");
    const queryClient = useQueryClient();

    const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
    const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [isBulkRetryOpen, setIsBulkRetryOpen] = useState(false);
    const [isCleanupOpen, setIsCleanupOpen] = useState(false);
    const [isCleanupConfirmOpen, setIsCleanupConfirmOpen] = useState(false);
    const [cleanupState, setCleanupState] = useState(DEFAULT_CLEANUP);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const listQueryInput = useMemo(() => buildListQuery(appliedFilters), [appliedFilters]);
    const summaryQueryInput = useMemo(() => buildSummaryQuery(appliedFilters), [appliedFilters]);

    const listQuery = useDeliveryTasks(listQueryInput, { enabled: canRead });
    const summaryQuery = useDeliveryTaskSummary(summaryQueryInput, { enabled: canRead });
    const detailQuery = useDeliveryTask(selectedTaskId ?? "", { enabled: canRead && Boolean(selectedTaskId) });
    const retryMutation = useRetryDeliveryTask();
    const retryFailedMutation = useRetryFailedDeliveryTasks();
    const cleanupMutation = useCleanupDeliveryTasks();

    const tasks = listQuery.data?.items ?? [];
    const nextCursor = listQuery.data?.nextCursor ?? null;
    const selectedTaskPreview = tasks.find((task) => task.id === selectedTaskId) ?? null;
    const selectedTask = detailQuery.data ?? selectedTaskPreview;
    const failedCount = summaryQuery.data?.failedCount ?? 0;
    const scopeSummary = describeScope(appliedFilters);
    const bulkRetryCompatible = appliedFilters.status === "ALL" || appliedFilters.status === "FAILED";

    const applyFilters = () => {
        setAppliedFilters({
            ...draftFilters,
            orgId: draftFilters.orgId.trim(),
            referenceType: draftFilters.referenceType.trim(),
            referenceId: draftFilters.referenceId.trim(),
            lastErrorContains: draftFilters.lastErrorContains.trim(),
            limit: clampLimit(draftFilters.limit),
        });
    };

    const resetFilters = () => {
        setDraftFilters(DEFAULT_FILTERS);
        setAppliedFilters(DEFAULT_FILTERS);
    };

    const handleLoadMore = async () => {
        if (!nextCursor || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const response = await listDeliveryTasks(buildListQuery(appliedFilters, nextCursor));
            queryClient.setQueryData<DeliveryTaskListResponse | undefined>(
                getDeliveryTasksQueryKey(listQueryInput),
                (current) => ({
                    items: mergeTasks(current?.items, response.items),
                    nextCursor: response.nextCursor ?? null,
                }),
            );
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to load more delivery tasks."));
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleRetryTask = async (task: DeliveryTask) => {
        if (!canRetry || task.status !== "FAILED") return;
        try {
            const result = await retryMutation.mutateAsync(task.id);
            toast.success(`Retried task ${task.id}. Replacement task: ${result.task.id}`);
            setSelectedTaskId(result.task.id);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to retry delivery task."));
        }
    };

    const handleRetryFailed = async () => {
        try {
            const result = await retryFailedMutation.mutateAsync(buildRetryFailedBody(appliedFilters));
            toast.success(`Retried ${result.retried} failed task(s).`);
            setIsBulkRetryOpen(false);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to retry failed tasks."));
        }
    };

    const runCleanup = async (dryRunOverride?: boolean) => {
        try {
            const result = await cleanupMutation.mutateAsync({
                ...buildCleanupBody(cleanupState),
                dryRun: dryRunOverride ?? cleanupState.dryRun,
            });
            toast.success(result.dryRun ? `Dry run matched ${result.count} task(s).` : `Deleted ${result.count} task(s).`);
            setIsCleanupOpen(false);
            setIsCleanupConfirmOpen(false);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Failed to clean up delivery tasks."));
        }
    };

    if (!canRead) {
        return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
                <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 ring-1 ring-amber-200">
                        <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-amber-950">Platform Delivery Tasks</h1>
                        <p className="mt-2 max-w-2xl text-sm text-amber-900/80">
                            The UI is wired, but this session does not have
                            <span className="mx-1 font-medium">platform.delivery_tasks.read</span>
                            permission. The backend would reject the list and summary calls anyway.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-[30px] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.08),_transparent_30%),radial-gradient(circle_at_right_center,_rgba(59,130,246,0.05),_transparent_30%),linear-gradient(180deg,_#ffffff,_rgba(250,250,250,0.98))] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_16px_40px_rgba(0,0,0,0.04)]">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-zinc-500 shadow-sm">
                            Platform delivery control plane
                        </div>
                        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">Delivery Tasks</h1>
                        <p className="mt-3 text-sm leading-6 text-zinc-600">
                            Inspect queued and failed platform delivery work, review redacted payload summaries,
                            inspect push receipts, and retry only the tasks the backend still considers retryable.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => {
                                queryClient.invalidateQueries({ queryKey: getDeliveryTasksQueryKey(listQueryInput) });
                                queryClient.invalidateQueries({ queryKey: getDeliveryTaskSummaryQueryKey(summaryQueryInput) });
                                if (selectedTaskId) queryClient.invalidateQueries({ queryKey: ["platform-delivery-task", selectedTaskId] });
                            }}
                        >
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Refresh
                        </Button>
                        <Button
                            onClick={() => setIsBulkRetryOpen(true)}
                            disabled={!canRetry || !bulkRetryCompatible || failedCount === 0 || retryFailedMutation.isPending}
                            className="rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                        >
                            {retryFailedMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Retry failed tasks
                        </Button>
                        {canCleanup ? (
                            <Button
                                variant="outline"
                                onClick={() => setIsCleanupOpen(true)}
                                className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Cleanup
                            </Button>
                        ) : null}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-4">
                <SmallStatCard title="Total tasks" value={summaryQuery.data?.total ?? 0} icon={<Inbox className="h-5 w-5" />} />
                <SmallStatCard title="Failed tasks" value={failedCount} icon={<AlertTriangle className="h-5 w-5" />} tone="rose" />
                <ListStatCard
                    title="By status"
                    items={(summaryQuery.data?.byStatus ?? []).map((entry) => ({
                        label: STATUS_LABELS[entry.status],
                        value: entry.count,
                    }))}
                    isLoading={summaryQuery.isLoading}
                />
                <ListStatCard
                    title="By kind"
                    items={(summaryQuery.data?.byKind ?? []).map((entry) => ({
                        label: KIND_LABELS[entry.kind],
                        value: entry.count,
                    }))}
                    isLoading={summaryQuery.isLoading}
                />
            </section>

            <Card className="rounded-[28px] border-zinc-200 shadow-sm">
                <CardHeader>
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <CardTitle className="text-lg text-zinc-950">Top errors</CardTitle>
                            <p className="text-sm text-zinc-500">Filtered scope: {scopeSummary}.</p>
                        </div>
                        {!bulkRetryCompatible && canRetry ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Bulk retry only makes sense with status set to All or Failed because the backend scans failed tasks only.
                            </div>
                        ) : null}
                    </div>
                </CardHeader>
                <CardContent>
                    {summaryQuery.isLoading ? (
                        <div className="grid gap-3 md:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <Skeleton key={index} className="h-24 rounded-2xl" />
                            ))}
                        </div>
                    ) : (summaryQuery.data?.topErrors?.length ?? 0) === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
                            No common errors surfaced for the current scope.
                        </div>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {(summaryQuery.data?.topErrors ?? []).slice(0, 6).map((entry, index) => (
                                <div key={`${entry.kind}-${index}`} className="rounded-2xl border border-zinc-200 bg-white p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-700">
                                            {KIND_LABELS[entry.kind]}
                                        </Badge>
                                        <span className="text-sm font-semibold text-zinc-900">{entry.count}</span>
                                    </div>
                                    <p className="mt-3 text-sm leading-6 text-zinc-700">{truncateText(entry.lastError, 180)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Sheet open={Boolean(selectedTaskId)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
                <SheetContent side="right" className="w-full max-w-3xl gap-0 p-0">
                    <SheetHeader className="border-b border-zinc-200 px-6 py-5">
                        <SheetTitle className="text-xl text-zinc-950">Delivery task detail</SheetTitle>
                        <SheetDescription>Full metadata, payload summary, and push provider receipts.</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 overflow-y-auto p-6">
                        {detailQuery.isLoading && !selectedTaskPreview ? (
                            <div className="space-y-3">
                                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}
                            </div>
                        ) : !selectedTask ? (
                            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-sm text-zinc-500">No task selected.</div>
                        ) : (
                            <>
                                <Card className="rounded-3xl border-zinc-200">
                                    <CardHeader>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <CardTitle className="text-base text-zinc-950">{selectedTask.id}</CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={cn("border", getStatusTone(selectedTask.status))}>{STATUS_LABELS[selectedTask.status]}</Badge>
                                                <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-700">{KIND_LABELS[selectedTask.kind]}</Badge>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grid gap-4 md:grid-cols-2">
                                        <DetailField label="Queue" value={selectedTask.queueName} />
                                        <DetailField label="Job" value={selectedTask.jobName} />
                                        <DetailField label="Org ID" value={selectedTask.orgId} />
                                        <DetailField label="User ID" value={selectedTask.userId} />
                                        <DetailField label="Reference type" value={selectedTask.referenceType} />
                                        <DetailField label="Reference ID" value={selectedTask.referenceId} />
                                        <DetailField label="Attempts" value={`${selectedTask.attemptCount} / ${selectedTask.maxAttempts}`} />
                                        <DetailField label="Replaced by task" value={selectedTask.replacedByTaskId} />
                                        <DetailField label="Queued at" value={formatDateTime(selectedTask.queuedAt)} />
                                        <DetailField label="Last attempt" value={formatDateTime(selectedTask.lastAttemptAt)} />
                                        <DetailField label="Processing started" value={formatDateTime(selectedTask.processingStartedAt)} />
                                        <DetailField label="Completed at" value={formatDateTime(selectedTask.completedAt)} />
                                        <DetailField label="Retried at" value={formatDateTime(selectedTask.retriedAt)} />
                                        <DetailField label="Created at" value={formatDateTime(selectedTask.createdAt)} />
                                        <DetailField label="Updated at" value={formatDateTime(selectedTask.updatedAt)} />
                                    </CardContent>
                                </Card>

                                <Card className="rounded-3xl border-zinc-200">
                                    <CardHeader><CardTitle className="text-base text-zinc-950">Last error</CardTitle></CardHeader>
                                    <CardContent><div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">{selectedTask.lastError || "No recorded error."}</div></CardContent>
                                </Card>

                                <Card className="rounded-3xl border-zinc-200">
                                    <CardHeader><CardTitle className="text-base text-zinc-950">Payload summary</CardTitle></CardHeader>
                                    <CardContent><pre className="max-h-[320px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-950 p-4 text-xs leading-6 text-zinc-100">{formatJson(selectedTask.payloadSummary)}</pre></CardContent>
                                </Card>

                                {selectedTask.receiptSummary ? (
                                    <Card className="rounded-3xl border-zinc-200">
                                        <CardHeader><CardTitle className="text-base text-zinc-950">Push receipt summary</CardTitle></CardHeader>
                                        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                            <MetricChip label="Total" value={selectedTask.receiptSummary.total} />
                                            <MetricChip label="Pending" value={selectedTask.receiptSummary.pending} />
                                            <MetricChip label="Delivered" value={selectedTask.receiptSummary.delivered} />
                                            <MetricChip label="Error" value={selectedTask.receiptSummary.error} />
                                            <MetricChip label="Latest check" value={formatDateTime(selectedTask.receiptSummary.latestCheckedAt)} />
                                        </CardContent>
                                    </Card>
                                ) : null}

                                {selectedTask.providerReceipts && selectedTask.providerReceipts.length > 0 ? (
                                    <Card className="rounded-3xl border-zinc-200">
                                        <CardHeader><CardTitle className="text-base text-zinc-950">Provider receipts</CardTitle></CardHeader>
                                        <CardContent>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="border-zinc-200">
                                                        <TableHead>Provider</TableHead>
                                                        <TableHead>Platform</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead>User / device</TableHead>
                                                        <TableHead>Tickets</TableHead>
                                                        <TableHead>Error</TableHead>
                                                        <TableHead>Checked</TableHead>
                                                        <TableHead>Details</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedTask.providerReceipts.map((receipt) => (
                                                        <TableRow key={receipt.id} className="border-zinc-200">
                                                            <TableCell className="align-top whitespace-normal"><div className="font-medium text-zinc-900">{receipt.provider}</div><div className="text-xs text-zinc-500">{receipt.id}</div></TableCell>
                                                            <TableCell className="align-top text-sm text-zinc-700">{receipt.platform || "-"}</TableCell>
                                                            <TableCell className="align-top text-sm text-zinc-700">{receipt.status || "-"}</TableCell>
                                                            <TableCell className="align-top whitespace-normal text-sm text-zinc-700"><div>{receipt.userId || "-"}</div><div className="text-xs text-zinc-500">{receipt.pushDeviceId || receipt.deviceTokenMasked || "-"}</div></TableCell>
                                                            <TableCell className="align-top whitespace-normal text-sm text-zinc-700"><div>{receipt.providerTicketId || "-"}</div><div className="text-xs text-zinc-500">{receipt.providerReceiptId || "-"}</div></TableCell>
                                                            <TableCell className="max-w-[240px] align-top whitespace-normal text-sm text-zinc-700">{receipt.errorMessage || receipt.errorCode || "-"}</TableCell>
                                                            <TableCell className="align-top text-sm text-zinc-700">{formatDateTime(receipt.checkedAt)}</TableCell>
                                                            <TableCell className="max-w-[280px] align-top whitespace-normal"><pre className="max-h-32 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-700">{formatJson(receipt.details)}</pre></TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </CardContent>
                                    </Card>
                                ) : null}
                            </>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <Dialog open={isBulkRetryOpen} onOpenChange={setIsBulkRetryOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Retry failed tasks</DialogTitle>
                        <DialogDescription>This only targets failed tasks. Everything else stays untouched.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700"><div className="font-medium text-zinc-900">Scope</div><p className="mt-2 leading-6">{scopeSummary}</p></div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <MetricChip label="Failed in summary scope" value={failedCount} />
                            <MetricChip label="Bulk retry limit" value={clampLimit(appliedFilters.limit)} />
                        </div>
                        {!bulkRetryCompatible ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Reset status to All or Failed before using bulk retry.</div> : null}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBulkRetryOpen(false)}>Cancel</Button>
                        <Button onClick={handleRetryFailed} disabled={!bulkRetryCompatible || retryFailedMutation.isPending} className="bg-zinc-900 text-white hover:bg-zinc-800">
                            {retryFailedMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Retrying...</> : <><RefreshCcw className="mr-2 h-4 w-4" />Retry failed tasks</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCleanupOpen} onOpenChange={setIsCleanupOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Cleanup terminal tasks</DialogTitle>
                        <DialogDescription>Start with a dry run unless you are absolutely sure the retention window is correct.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-900">Older than days</label>
                            <Input inputMode="numeric" value={cleanupState.olderThanDays} onChange={(event) => setCleanupState((current) => ({ ...current, olderThanDays: event.target.value.replace(/[^\d]/g, "") }))} />
                        </div>
                        <div className="space-y-3">
                            <div className="text-sm font-medium text-zinc-900">Statuses</div>
                            <div className="space-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                                {CLEANUP_DELIVERY_TASK_STATUSES.map((status) => {
                                    const checked = cleanupState.statuses.includes(status);
                                    return (
                                        <label key={status} className="flex items-center gap-3 text-sm text-zinc-700">
                                            <Checkbox checked={checked} onCheckedChange={(next) => setCleanupState((current) => ({ ...current, statuses: next ? [...current.statuses, status] : current.statuses.filter((entry) => entry !== status) }))} />
                                            {STATUS_LABELS[status]}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                            <Checkbox checked={cleanupState.dryRun} onCheckedChange={(checked) => setCleanupState((current) => ({ ...current, dryRun: Boolean(checked) }))} />
                            Dry run first
                        </label>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCleanupOpen(false)}>Cancel</Button>
                        <Button
                            onClick={() => {
                                if (cleanupState.statuses.length === 0) {
                                    toast.error("Select at least one terminal status.");
                                    return;
                                }
                                if (cleanupState.dryRun) {
                                    void runCleanup(true);
                                } else {
                                    setIsCleanupConfirmOpen(true);
                                }
                            }}
                            disabled={cleanupMutation.isPending}
                            className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                            {cleanupMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running...</> : cleanupState.dryRun ? "Run dry cleanup" : "Delete matching tasks"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={isCleanupConfirmOpen}
                onOpenChange={setIsCleanupConfirmOpen}
                title="Confirm destructive cleanup"
                description={`This will permanently delete ${cleanupState.statuses.join(", ").toLowerCase()} tasks older than ${buildCleanupBody(cleanupState).olderThanDays} day(s).`}
                confirmText="Delete tasks"
                variant="destructive"
                onConfirm={() => {
                    void runCleanup(false);
                }}
            />
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="rounded-[22px] border border-zinc-200 bg-white p-3 shadow-xs">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">{label}</div>
            <div className="mt-2">{children}</div>
        </div>
    );
}

function SmallStatCard({ title, value, icon, tone = "zinc" }: { title: string; value: number; icon: ReactNode; tone?: "zinc" | "rose" }) {
    const toneClass = tone === "rose" ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
    return (
        <Card className="rounded-[28px] border-zinc-200 shadow-sm">
            <CardContent className="p-5">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneClass)}>{icon}</div>
                <div className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">{value}</div>
                <div className="mt-1 text-sm font-medium text-zinc-800">{title}</div>
            </CardContent>
        </Card>
    );
}

function ListStatCard({ title, items, isLoading }: { title: string; items: Array<{ label: string; value: number }>; isLoading?: boolean }) {
    return (
        <Card className="rounded-[28px] border-zinc-200 shadow-sm">
            <CardContent className="p-5">
                <div className="text-sm font-medium text-zinc-900">{title}</div>
                {isLoading ? (
                    <div className="mt-4 space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-8 rounded-xl" />)}
                    </div>
                ) : items.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">No data for the current scope.</div>
                ) : (
                    <div className="mt-4 space-y-2">
                        {items.slice(0, 5).map((item) => (
                            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
                                <span className="text-sm text-zinc-700">{item.label}</span>
                                <span className="text-sm font-semibold text-zinc-900">{item.value}</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</div>
            <div className="mt-2 break-all text-sm text-zinc-900">{value || "-"}</div>
        </div>
    );
}

function MetricChip({ label, value }: { label: string; value: number | string }) {
    const isZero = value === 0 || value === "0";
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</div>
            <div className="mt-2 flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-950">{value}</span>
                {typeof value === "number" ? <span className="text-zinc-400">{isZero ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}</span> : null}
            </div>
        </div>
    );
}
