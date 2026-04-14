export const DELIVERY_TASK_KINDS = [
    "AUTH_PASSWORD_EMAIL",
    "PUSH_NOTIFICATION",
    "BROADCAST_FANOUT",
] as const;

export type DeliveryTaskKind = (typeof DELIVERY_TASK_KINDS)[number];

export const DELIVERY_TASK_STATUSES = [
    "QUEUED",
    "PROCESSING",
    "SUCCEEDED",
    "FAILED",
    "RETRIED",
] as const;

export type DeliveryTaskStatus = (typeof DELIVERY_TASK_STATUSES)[number];

export const CLEANUP_DELIVERY_TASK_STATUSES = [
    "SUCCEEDED",
    "FAILED",
    "RETRIED",
] as const;

export type CleanupDeliveryTaskStatus = (typeof CLEANUP_DELIVERY_TASK_STATUSES)[number];

export type ListDeliveryTasksQuery = {
    kind?: DeliveryTaskKind;
    status?: DeliveryTaskStatus;
    orgId?: string;
    referenceType?: string;
    referenceId?: string;
    lastErrorContains?: string;
    cursor?: string;
    limit?: number;
};

export type PushReceiptSummary = {
    total: number;
    pending: number;
    delivered: number;
    error: number;
    latestCheckedAt: string | null;
};

export type PushDeliveryReceipt = {
    id: string;
    provider: string;
    platform: string;
    status: string;
    userId: string | null;
    pushDeviceId: string | null;
    deviceTokenMasked: string | null;
    providerTicketId: string | null;
    providerReceiptId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    details: Record<string, unknown> | null;
    checkedAt: string | null;
    createdAt: string;
    updatedAt: string;
};

export type DeliveryTask = {
    id: string;
    kind: DeliveryTaskKind;
    status: DeliveryTaskStatus;
    queueName: string;
    jobName: string;
    orgId: string | null;
    userId: string | null;
    referenceType: string | null;
    referenceId: string | null;
    attemptCount: number;
    maxAttempts: number;
    queuedAt: string;
    lastAttemptAt: string | null;
    processingStartedAt: string | null;
    completedAt: string | null;
    lastError: string | null;
    retriedAt: string | null;
    replacedByTaskId: string | null;
    payloadSummary: Record<string, unknown>;
    receiptSummary?: PushReceiptSummary | null;
    providerReceipts?: PushDeliveryReceipt[];
    createdAt: string;
    updatedAt: string;
};

export type DeliveryTaskListResponse = {
    items: DeliveryTask[];
    nextCursor?: string | null;
};

export type DeliveryTaskSummaryResponse = {
    total: number;
    failedCount: number;
    oldestFailedAt: string | null;
    newestFailedAt: string | null;
    byStatus: Array<{ status: DeliveryTaskStatus; count: number }>;
    byKind: Array<{ kind: DeliveryTaskKind; count: number }>;
    topErrors: Array<{ kind: DeliveryTaskKind; lastError: string; count: number }>;
};

export type RetryDeliveryTaskResponse = {
    sourceTaskId: string;
    task: DeliveryTask;
};

export type RetryFailedDeliveryTasksBody = {
    kind?: DeliveryTaskKind;
    orgId?: string;
    referenceType?: string;
    referenceId?: string;
    lastErrorContains?: string;
    limit?: number;
};

export type RetryFailedDeliveryTasksResponse = {
    requested: number;
    retried: number;
    sourceTaskIds: string[];
    replacementTaskIds: string[];
};

export type CleanupDeliveryTasksBody = {
    olderThanDays?: number;
    statuses?: CleanupDeliveryTaskStatus[];
    dryRun?: boolean;
};

export type CleanupDeliveryTasksResponse = {
    count: number;
    olderThan: string;
    olderThanDays: number;
    statuses: DeliveryTaskStatus[];
    dryRun: boolean;
};
