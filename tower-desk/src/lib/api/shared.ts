import type {
    BaseRole,
    Broadcast,
    BroadcastAudience,
    BuildingStatus,
    Conversation,
    ConversationCounterpartyGroup,
    ConversationMessage,
    ConversationParticipant,
    ConversationType,
    NotificationType,
    NotificationItem,
    OwnerApprovalStatus,
    OccupancyResponseDto,
    RequestAttachment,
    RequestQueue,
    RequestComment,
    RequestEstimateStatus,
    RequestPolicyRoute,
    RequestRecommendation,
    RequestPriority,
    RequesterContext,
    RequestTenancyContext,
    RequestStatus,
    RequestUnit,
    ServiceRequest,
    User
} from '../types';
import { mapBroadcastMetadata, normalizeBroadcastAudiences } from '../broadcastMetadata';
import { IS_DEV } from './config';
import { toCanonicalRole } from '../roles';
import { normalizeUserFromApi } from '../userAccess';

export const getPermissionSet = (user?: User | null) => {
    const keys = [
        ...(user?.roleKeys ?? []),
        ...(user?.orgRoleKeys ?? []),
        ...(user?.effectivePermissions ?? []),
    ].map((key) => String(key).toLowerCase());
    return new Set(keys);
};

export function truncateForLog(value: unknown, max = 800) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

export function logDevPayload(label: string, payload: unknown, meta?: Record<string, unknown>) {
    if (!IS_DEV || typeof window === "undefined") return;
    if (meta) {
        console.log(`[API] ${label}`, { ...meta, payload });
        return;
    }
    console.log(`[API] ${label}`, payload);
}

// Helper to unwrap API response
export function getArray(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.items && Array.isArray(res.items)) return res.items;
    if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
    if (res.data && Array.isArray(res.data)) return res.data;
    return [];
}

export function mapRequestStatus(value: any): RequestStatus {
    if (typeof value === 'number') {
        const statusMap: Record<number, RequestStatus> = {
            1: 'pending',
            2: 'assigned',
            3: 'in-progress',
            4: 'on-hold',
            5: 'completed',
            6: 'cancelled'
        };
        return statusMap[value] || 'pending';
    }
    const normalized = String(value || '').toLowerCase().replace(/[\s-_]/g, '');
    if (normalized === 'new' || normalized === 'open') return 'pending';
    if (normalized === 'assigned') return 'assigned';
    if (normalized === 'inprogress') return 'in-progress';
    if (normalized === 'onhold') return 'on-hold';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
    return 'pending';
}

export function mapRequestStatusToApi(status: RequestStatus): number {
    const statusMap: Record<RequestStatus, number> = {
        pending: 1,
        assigned: 2,
        'in-progress': 3,
        'on-hold': 4,
        completed: 5,
        cancelled: 6
    };
    return statusMap[status] || 1;
}

export function mapRequestStatusToApiStatus(status: RequestStatus): string {
    const statusMap: Record<RequestStatus, string> = {
        pending: 'OPEN',
        assigned: 'ASSIGNED',
        'in-progress': 'IN_PROGRESS',
        'on-hold': 'ON_HOLD',
        completed: 'COMPLETED',
        cancelled: 'CANCELED'
    };
    return statusMap[status] || 'OPEN';
}
export function mapOccupancyResponseDto(entry: any): OccupancyResponseDto {
    const unit = entry?.unit ?? {};
    const resident = entry?.resident ?? {};
    const unitId = entry?.unitId ?? unit?.id ?? '';
    const residentUserId = entry?.residentUserId ?? resident?.id ?? '';

    return {
        id: String(entry?.id ?? ''),
        buildingId: String(entry?.buildingId ?? ''),
        unitId: String(unitId),
        residentUserId: String(residentUserId),
        status: String(entry?.status ?? ''),
        startAt: String(entry?.startAt ?? ''),
        endAt: entry?.endAt ?? null,
        unit: {
            id: String(unit?.id ?? unitId ?? ''),
            label: String(unit?.label ?? ''),
        },
        resident: {
            id: String(resident?.id ?? residentUserId ?? ''),
            email: String(resident?.email ?? ''),
            name: resident?.name ?? null,
        },
    };
}

export function mapRequestPriority(value: any): RequestPriority {
    if (typeof value === 'number') {
        const priorityMap: Record<number, RequestPriority> = {
            1: 'low',
            2: 'medium',
            3: 'high',
            4: 'urgent'
        };
        return priorityMap[value] || 'medium';
    }
    const normalized = String(value || 'medium').trim().toLowerCase();
    switch (normalized) {
        case 'low':
            return 'low';
        case 'normal':
        case 'medium':
            return 'medium';
        case 'high':
            return 'high';
        case 'urgent':
            return 'urgent';
        default:
            return 'medium';
    }
}

const coerceNullableString = (value: unknown) => {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized || null;
};

export function mapRequestRecommendation(value: unknown): RequestRecommendation | null {
    return coerceNullableString(value);
}

export function mapRequestPolicyRoute(value: unknown): RequestPolicyRoute | null {
    return coerceNullableString(value) as RequestPolicyRoute | null;
}

export function mapRequestQueue(value: unknown): RequestQueue | null {
    return coerceNullableString(value) as RequestQueue | null;
}

export function mapOwnerApprovalStatus(value: unknown): OwnerApprovalStatus | null {
    return coerceNullableString(value) as OwnerApprovalStatus | null;
}

export function mapRequestEstimateStatus(value: unknown): RequestEstimateStatus | null {
    return coerceNullableString(value) as RequestEstimateStatus | null;
}

const mapRequesterOccupancyStatus = (value: unknown): RequesterContext["residentOccupancyStatus"] => {
    const normalized = coerceNullableString(value)?.toUpperCase();
    switch (normalized) {
        case "ACTIVE":
        case "NONE":
        case "FORMER":
            return normalized;
        default:
            return null;
    }
};

const mapRequesterInviteStatus = (value: unknown): RequesterContext["residentInviteStatus"] => {
    const normalized = coerceNullableString(value)?.toUpperCase();
    switch (normalized) {
        case "PENDING":
        case "ACCEPTED":
        case "FAILED":
        case "EXPIRED":
            return normalized;
        default:
            return null;
    }
};

export function mapRequesterContext(value: any): RequesterContext | null {
    if (!value || typeof value !== "object") return null;

    const currentUnitOccupant = value.currentUnitOccupant && typeof value.currentUnitOccupant === "object"
        ? value.currentUnitOccupant
        : null;
    const occupantUserId = currentUnitOccupant?.userId ?? currentUnitOccupant?.id;

    return {
        isResident: Boolean(value.isResident),
        residentOccupancyStatus: mapRequesterOccupancyStatus(value.residentOccupancyStatus),
        residentInviteStatus: mapRequesterInviteStatus(value.residentInviteStatus),
        isFormerResident: Boolean(value.isFormerResident),
        currentUnitOccupiedByRequester: mapBooleanFlag(value.currentUnitOccupiedByRequester),
        currentUnitOccupant: occupantUserId
            ? {
                userId: String(occupantUserId),
                name: coerceNullableString(currentUnitOccupant?.name),
            }
            : null,
    };
}

const mapRequestTenancyLabel = (value: unknown): RequestTenancyContext["label"] => {
    const normalized = coerceNullableString(value)?.toUpperCase();
    switch (normalized) {
        case "CURRENT_OCCUPANCY":
        case "PREVIOUS_OCCUPANCY":
        case "NO_ACTIVE_OCCUPANCY":
        case "UNKNOWN_TENANCY_CYCLE":
            return normalized;
        default:
            return null;
    }
};

const mapRequestLeaseLabel = (value: unknown): RequestTenancyContext["leaseLabel"] => {
    const normalized = coerceNullableString(value)?.toUpperCase();
    switch (normalized) {
        case "CURRENT_LEASE":
        case "PREVIOUS_LEASE":
        case "NO_ACTIVE_LEASE":
        case "UNKNOWN_LEASE_CYCLE":
            return normalized;
        default:
            return null;
    }
};

const mapRequestTenancyContextSource = (value: unknown): RequestTenancyContext["tenancyContextSource"] => {
    const normalized = coerceNullableString(value)?.toUpperCase();
    switch (normalized) {
        case "SNAPSHOT":
        case "HISTORICAL_INFERENCE":
        case "UNRESOLVED":
            return normalized;
        default:
            return null;
    }
};

export function mapRequestTenancyContext(value: any): RequestTenancyContext | null {
    if (!value || typeof value !== "object") return null;

    return {
        occupancyIdAtCreation: coerceNullableString(value.occupancyIdAtCreation),
        leaseIdAtCreation: coerceNullableString(value.leaseIdAtCreation),
        currentOccupancyId: coerceNullableString(value.currentOccupancyId),
        currentLeaseId: coerceNullableString(value.currentLeaseId),
        isCurrentOccupancy: mapBooleanFlag(value.isCurrentOccupancy),
        isCurrentLease: mapBooleanFlag(value.isCurrentLease),
        label: mapRequestTenancyLabel(value.label),
        leaseLabel: mapRequestLeaseLabel(value.leaseLabel),
        tenancyContextSource: mapRequestTenancyContextSource(value.tenancyContextSource),
        leaseContextSource: mapRequestTenancyContextSource(value.leaseContextSource),
    };
}

export function mapRequestPolicy(value: any): ServiceRequest["policy"] {
    if (!value || typeof value !== "object") return null;
    return {
        route: mapRequestPolicyRoute(value?.route),
        recommendation: mapRequestRecommendation(value?.recommendation),
        summary: coerceNullableString(value?.summary),
        isEmergency: mapBooleanFlag(value?.isEmergency),
        isLikeForLike: mapBooleanFlag(value?.isLikeForLike),
        isUpgrade: mapBooleanFlag(value?.isUpgrade),
        isMajorReplacement: mapBooleanFlag(value?.isMajorReplacement),
        isResponsibilityDisputed: mapBooleanFlag(value?.isResponsibilityDisputed),
    };
}

export function mapBooleanFlag(value: unknown): boolean | null {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y"].includes(normalized)) return true;
        if (["false", "0", "no", "n"].includes(normalized)) return false;
    }
    return null;
}

export function mapRequestAttachments(data: any): RequestAttachment[] {
    const sources = [data, data?.request, data?.item, data?.data, data?.payload].filter(Boolean);
    let raw: any = [];
    for (const source of sources) {
        if (!source) continue;
        raw = source.attachments ?? source.files ?? source.images ?? source.attachmentUrls ?? source.attachmentURLs ?? source.media ?? [];
        if (raw && (Array.isArray(raw) || raw.items || raw.files)) {
            break;
        }
    }
    const list = Array.isArray(raw)
        ? raw
        : (raw?.items && Array.isArray(raw.items))
            ? raw.items
            : (raw?.files && Array.isArray(raw.files))
                ? raw.files
                : [];
    const attachments: RequestAttachment[] = [];
    list.forEach((entry: any, index: number) => {
        if (!entry) return;
        if (typeof entry === 'string') {
            const fileUrl = entry;
            const fileName = fileUrl.split('/').pop() || `attachment-${index + 1}`;
            attachments.push({
                id: String(index),
                fileUrl,
                fileName,
                contentType: ''
            });
            return;
        }
        const fileUrl = entry.fileUrl ?? entry.url ?? entry.uri ?? entry.path ?? entry.filePath ?? entry.secureUrl ?? entry.secure_url;
        if (!fileUrl) return;
        const fileName = entry.fileName ?? entry.name ?? entry.originalName ?? entry.filename ?? entry.key ?? String(fileUrl).split('/').pop() ?? `attachment-${index + 1}`;
        const contentType = entry.contentType ?? entry.mimeType ?? entry.mimetype ?? entry.type ?? '';
        const sizeBytes = entry.sizeBytes ?? entry.size ?? entry.fileSize ?? entry.bytes;
        const createdAt = entry.createdAt ?? entry.uploadedAt ?? entry.timestamp;
        const id = entry.id ?? entry.attachmentId ?? entry.fileId ?? entry._id ?? `${index}-${fileName}`;
        attachments.push({
            id: String(id),
            fileUrl: String(fileUrl),
            fileName: String(fileName),
            contentType: String(contentType),
            sizeBytes: typeof sizeBytes === 'number' ? sizeBytes : undefined,
            createdAt: createdAt ? String(createdAt) : undefined
        });
    });
    return attachments;
}

export function mapRequestUnit(data: any): RequestUnit | undefined {
    const unit = data?.unit ?? data?.unitInfo ?? data?.unitDetails ?? data?.occupancy?.unit ?? null;
    const unitId = unit?.id ?? unit?.unitId ?? data?.unitId ?? data?.unit_id ?? data?.unitID;
    const label = unit?.label ?? unit?.unitLabel ?? unit?.name ?? data?.unitLabel ?? data?.unitNumber ?? data?.unit;
    const number = data?.unitNumber ?? unit?.number ?? unit?.unitNumber ?? unit?.unitNo;
    const floor = unit?.floor ?? unit?.floorNumber ?? data?.unitFloor ?? data?.unitFloorNumber ?? data?.floor ?? data?.floorNumber;
    if (!unitId && !label && number === undefined && floor === undefined) return undefined;
    return {
        id: unitId ? String(unitId) : undefined,
        label: label ? String(label) : undefined,
        number: number ?? undefined,
        floor: floor ?? undefined
    };
}

export function mapRequestCreator(data: any): ServiceRequest['createdBy'] | undefined {
    if (!data) return undefined;
    const user = data.createdBy ?? data.created_by ?? data.creator ?? data.createdByUser ?? data.user ?? null;
    const directName = data.createdByName ?? data.creatorName ?? data.created_by_name;
    const directEmail = data.createdByEmail ?? data.creatorEmail ?? data.created_by_email;
    if (!user && !directName && !directEmail) return undefined;
    const firstLast = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '';
    const fullName = user?.fullName ?? (firstLast || undefined);
    const name = user?.name ?? fullName ?? directName;
    const email = user?.email ?? user?.emailAddress ?? directEmail;
    const id = user?.id ?? user?.userId ?? user?._id;
    return {
        id: id ? String(id) : undefined,
        name,
        fullName,
        email
    };
}

export function mapRequestComment(comment: any): RequestComment {
    const user = comment?.user ?? comment?.author ?? comment?.createdBy ?? {};
    const userId = user?.userId ?? user?.id ?? comment?.userId ?? comment?.authorId;
    return {
        id: String(comment?.id ?? comment?.commentId ?? comment?._id ?? Math.random()),
        commentText: comment?.commentText ?? comment?.message ?? comment?.text ?? comment?.body ?? '',
        createdAt: comment?.createdAt ?? comment?.createdAtUtc ?? comment?.timestamp ?? new Date().toISOString(),
        visibility: comment?.visibility ?? comment?.commentVisibility ?? undefined,
        user: userId
            ? {
                userId: String(userId),
                fullName: user?.fullName ?? user?.name ?? comment?.userName ?? comment?.authorName,
                email: user?.email ?? comment?.userEmail ?? comment?.authorEmail
            }
            : undefined
    };
}

export function mapNotification(item: any): NotificationItem {
    const type = String(item?.type ?? item?.eventType ?? '');
    const normalizedType = type.toUpperCase();
    const backendTitle = item?.title ?? item?.subject;
    const resolvedTitle = backendTitle && String(backendTitle).trim().toLowerCase() !== "notification"
        ? backendTitle
        : getNotificationTitle(normalizedType) ?? backendTitle ?? 'Notification';
    const backendBody = item?.body ?? item?.message ?? item?.content;
    const rawData = item?.data ?? item?.payload;
    const normalizedData = rawData && typeof rawData === "object"
        ? (() => {
            const source = rawData as Record<string, unknown>;
            const buildingIds = Array.isArray(source.buildingIds)
                ? source.buildingIds.map((entry) => String(entry)).filter(Boolean)
                : [];
            const hasBroadcastContext = Boolean(
                normalizedType.includes("BROADCAST")
                || source.broadcastId
                || item?.broadcastId
                || source.metadata
                || item?.metadata
                || source.senderUserId
                || item?.senderUserId
            );
            if (!hasBroadcastContext) {
                return source;
            }
            return {
                ...source,
                broadcastId: String(source.broadcastId ?? item?.broadcastId ?? ""),
                buildingIds,
                senderUserId: source.senderUserId ?? item?.senderUserId ?? undefined,
                metadata: mapBroadcastMetadata(source.metadata ?? item?.metadata, { buildingIds }),
            };
        })()
        : rawData;
    return {
        id: String(item?.id ?? item?.notificationId ?? item?._id ?? ''),
        type,
        title: resolvedTitle,
        body: backendBody ?? getNotificationBody(normalizedType),
        data: normalizedData,
        ownerApprovalStatus: mapOwnerApprovalStatus(
            item?.ownerApprovalStatus
            ?? item?.data?.ownerApprovalStatus
            ?? item?.payload?.ownerApprovalStatus
        ),
        isEmergency: mapBooleanFlag(
            item?.isEmergency
            ?? item?.data?.isEmergency
            ?? item?.payload?.isEmergency
        ),
        readAt: item?.readAt ?? item?.read_at ?? null,
        dismissedAt: item?.dismissedAt ?? item?.dismissed_at ?? null,
        createdAt: item?.createdAt ?? item?.created_at ?? item?.timestamp
    };
}

export function getNotificationTitle(type: NotificationType | string) {
    switch (String(type).toUpperCase()) {
        case "MOVE_IN_REQUEST_CREATED":
            return "Move-in request received";
        case "MOVE_OUT_REQUEST_CREATED":
            return "Move-out request received";
        case "REQUEST_CREATED":
            return "Request created";
        case "REQUEST_ASSIGNED":
            return "Request assigned";
        case "REQUEST_STATUS_CHANGED":
            return "Request status updated";
        case "REQUEST_COMMENTED":
            return "New request comment";
        case "REQUEST_CANCELED":
            return "Request canceled";
        case "OWNER_APPROVAL_REQUESTED":
            return "Owner approval requested";
        case "OWNER_APPROVAL_APPROVED":
            return "Owner approved request";
        case "OWNER_APPROVAL_REJECTED":
            return "Owner rejected request";
        default:
            return undefined;
    }
}

export function getNotificationBody(type: NotificationType | string) {
    switch (String(type).toUpperCase()) {
        case "MOVE_IN_REQUEST_CREATED":
            return "A resident has submitted a move-in request. Review it in the management inbox.";
        case "MOVE_OUT_REQUEST_CREATED":
            return "A resident has submitted a move-out request. Review it in the management inbox.";
        case "REQUEST_CREATED":
            return "A new request was created.";
        case "REQUEST_ASSIGNED":
            return "A request was assigned to your team.";
        case "REQUEST_STATUS_CHANGED":
            return "A request status has changed.";
        case "REQUEST_COMMENTED":
            return "A new comment was added to a request.";
        case "REQUEST_CANCELED":
            return "A request was canceled.";
        case "OWNER_APPROVAL_REQUESTED":
            return "A maintenance request is waiting on owner approval.";
        case "OWNER_APPROVAL_APPROVED":
            return "The owner approved a maintenance request.";
        case "OWNER_APPROVAL_REJECTED":
            return "The owner rejected a maintenance request.";
        default:
            return undefined;
    }
}

export function isContractRequestNotification(type: NotificationType | string) {
    switch (String(type).toUpperCase()) {
        case "MOVE_IN_REQUEST_CREATED":
        case "MOVE_OUT_REQUEST_CREATED":
            return true;
        default:
            return false;
    }
}

export function mapBroadcast(item: any): Broadcast {
    const rawBuildingIds = item?.buildingIds ?? item?.building_ids ?? item?.buildings ?? [];
    const buildingIds = Array.isArray(rawBuildingIds)
        ? rawBuildingIds.map((entry) => String(entry?.id ?? entry))
        : [];
    const rawAudiences =
        item?.audiences
        ?? item?.audience
        ?? item?.recipientTypes
        ?? item?.recipient_types
        ?? item?.filters?.audiences
        ?? item?.filters?.audience
        ?? item?.targets?.audiences
        ?? item?.targets?.audience
        ?? item?.metadata?.audiences
        ?? item?.metadata?.audience
        ?? [];
    const audiences = normalizeBroadcastAudiences(rawAudiences);
    const sender = item?.sender ?? item?.createdBy ?? item?.user ?? {};
    const senderId = sender?.id ?? item?.senderUserId ?? item?.senderId ?? '';
    return {
        id: String(item?.id ?? item?.broadcastId ?? item?._id ?? ''),
        title: String(item?.title ?? ''),
        body: item?.body ?? item?.message ?? item?.content ?? undefined,
        buildingIds,
        audiences,
        metadata: mapBroadcastMetadata(item?.metadata, { audiences, buildingIds }),
        recipientCount: Number(item?.recipientCount ?? item?.recipient_count ?? item?.recipients ?? 0),
        sender: {
            id: String(senderId ?? ''),
            name: sender?.name ?? sender?.fullName ?? item?.senderName ?? undefined,
            email: sender?.email ?? item?.senderEmail ?? undefined
        },
        createdAt: String(item?.createdAt ?? item?.created_at ?? item?.timestamp ?? new Date().toISOString())
    };
}

export function mapConversationParticipant(participant: any): ConversationParticipant {
    const unit = participant?.unit ?? participant?.occupancy?.unit ?? null;
    const role =
        participant?.role ??
        participant?.roleKey ??
        participant?.roleName ??
        participant?.baseRole ??
        participant?.type ??
        participant?.user?.role ??
        participant?.user?.roleKey ??
        participant?.user?.baseRole ??
        null;
    const participantType =
        participant?.participantType ??
        participant?.kind ??
        participant?.type ??
        participant?.memberType ??
        participant?.user?.type ??
        null;
    return {
        id: String(participant?.id ?? participant?.userId ?? participant?._id ?? ''),
        name: participant?.name ?? participant?.fullName ?? participant?.displayName ?? undefined,
        email: participant?.email ?? participant?.user?.email ?? undefined,
        unitLabel:
            participant?.unitLabel ??
            participant?.unitNumber ??
            unit?.label ??
            unit?.unitLabel ??
            unit?.unitNumber ??
            unit?.number ??
            unit?.name ??
            null,
        buildingName:
            participant?.buildingName ??
            participant?.building?.name ??
            participant?.occupancy?.buildingName ??
            participant?.occupancy?.building?.name ??
            null,
        avatarUrl: participant?.avatarUrl ?? participant?.avatar ?? participant?.photoUrl ?? null,
        role: coerceNullableString(role),
        participantType: coerceNullableString(participantType),
        kind: coerceNullableString(participant?.kind)
    };
}

export function mapConversationMessage(message: any): ConversationMessage {
    const sender = message?.sender ?? message?.user ?? message?.createdBy ?? {};
    return {
        id: String(message?.id ?? message?.messageId ?? message?._id ?? ''),
        content: String(message?.content ?? message?.body ?? message?.message ?? ''),
        sender: mapConversationParticipant(sender),
        createdAt: String(message?.createdAt ?? message?.created_at ?? message?.timestamp ?? new Date().toISOString())
    };
}

const isConversationType = (value: string): value is ConversationType =>
    [
        "MANAGEMENT_INTERNAL",
        "MANAGEMENT_TENANT",
        "MANAGEMENT_OWNER",
        "OWNER_TENANT",
    ].includes(value);

const isConversationCounterpartyGroup = (value: string): value is ConversationCounterpartyGroup =>
    [
        "STAFF",
        "TENANT",
        "OWNER",
        "MIXED",
    ].includes(value);

export function mapConversation(item: any): Conversation {
    const participantsRaw = item?.participants ?? item?.members ?? item?.users ?? [];
    const messagesRaw = item?.messages ?? item?.messageHistory ?? [];
    const lastMessageRaw = item?.lastMessage ?? item?.last_message ?? (Array.isArray(messagesRaw) ? messagesRaw[0] : null);
    const type = coerceNullableString(item?.type ?? item?.conversationType ?? item?.conversation_type);
    const counterpartyGroup = coerceNullableString(
        item?.counterpartyGroup ?? item?.counterparty_group
    );
    return {
        id: String(item?.id ?? item?.conversationId ?? item?._id ?? ''),
        subject: item?.subject ?? item?.title ?? null,
        type: type && isConversationType(type) ? type : null,
        counterpartyGroup: counterpartyGroup && isConversationCounterpartyGroup(counterpartyGroup) ? counterpartyGroup : null,
        buildingId: item?.buildingId ?? item?.building_id ?? null,
        buildingName: item?.buildingName ?? item?.building?.name ?? null,
        orgId: item?.orgId ?? item?.org_id ?? null,
        orgName: item?.orgName ?? item?.organizationName ?? item?.org?.name ?? null,
        participants: Array.isArray(participantsRaw) ? participantsRaw.map(mapConversationParticipant) : [],
        unreadCount: Number(item?.unreadCount ?? item?.unread_count ?? item?.unread ?? 0),
        lastMessage: lastMessageRaw ? mapConversationMessage(lastMessageRaw) : null,
        messages: Array.isArray(messagesRaw) ? messagesRaw.map(mapConversationMessage) : undefined,
        createdAt: String(item?.createdAt ?? item?.created_at ?? new Date().toISOString()),
        updatedAt: String(item?.updatedAt ?? item?.updated_at ?? item?.createdAt ?? item?.created_at ?? new Date().toISOString())
    };
}

export const ROLE_PRIORITY: BaseRole[] = ['superadmin', 'org_admin', 'admin', 'building_admin', 'manager', 'service_provider', 'owner', 'employee', 'tenant'];
export const BASE_ROLE_KEYS = new Set<BaseRole>(ROLE_PRIORITY);

export const isBaseRoleKey = (value: string): value is BaseRole => BASE_ROLE_KEYS.has(value as BaseRole);

export function mapRoleValue(value: string): BaseRole | null {
    return toCanonicalRole(value) ?? null;
}

export function resolveRole(userData: any, payload?: any): BaseRole {
    if (userData?.persona?.isPlatformAdmin === true || payload?.persona?.isPlatformAdmin === true) {
        return 'superadmin';
    }

    const candidates: string[] = [];
    const pushCandidate = (value: unknown) => {
        if (typeof value === 'string' && value.trim()) {
            candidates.push(value);
        }
    };
    const pushCandidateList = (value: unknown) => {
        if (Array.isArray(value)) {
            value.forEach((item) => pushCandidate(item));
            return;
        }
        pushCandidate(value);
    };
    const pushRoleObject = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        const roleValue = (value as any).role ?? (value as any).roleName ?? (value as any).name ?? (value as any).key ?? (value as any).type;
        pushCandidate(roleValue);
    };
    const pushAccessAssignments = (value: unknown) => {
        if (!Array.isArray(value)) return;
        value.forEach((entry) => {
            if (!entry || typeof entry !== 'object') return;
            pushCandidate((entry as any).roleTemplateKey);
            pushCandidate((entry as any).roleTemplateName);
            pushCandidate((entry as any).roleKey);
            pushCandidate((entry as any).roleName);
        });
    };

    pushCandidate(userData?.role);
    pushCandidate(userData?.baseRole);
    pushCandidate(userData?.roleName);
    pushCandidate(userData?.userType);
    pushCandidate(userData?.type);
    pushCandidate(userData?.persona?.role);
    pushCandidate(userData?.persona?.type);
    pushCandidate(payload?.role);
    pushCandidate(payload?.baseRole);
    pushCandidate(payload?.roleName);
    pushCandidate(payload?.persona?.role);
    pushCandidate(payload?.persona?.type);
    pushCandidateList(userData?.orgRoleKeys);
    pushCandidateList(userData?.roleKeys);
    pushCandidateList(payload?.orgRoleKeys);
    pushCandidateList(payload?.roleKeys);
    pushAccessAssignments(userData?.orgAccess);
    pushAccessAssignments(payload?.orgAccess);
    pushAccessAssignments(userData?.buildingAccess);
    pushAccessAssignments(payload?.buildingAccess);

    const roles = userData?.roles ?? payload?.roles;
    if (Array.isArray(roles)) {
        roles.forEach((roleValue) => {
            if (typeof roleValue === 'string') {
                pushCandidate(roleValue);
                return;
            }
            pushRoleObject(roleValue);
        });
    } else {
        pushRoleObject(roles);
    }

    const mapped = new Set<BaseRole>();
    candidates.forEach((value) => {
        const mappedRole = mapRoleValue(value);
        if (mappedRole) mapped.add(mappedRole);
    });

    if (mapped.size === 0) {
        const assignments = [
            ...(Array.isArray(userData?.buildingAssignments) ? userData.buildingAssignments : []),
            ...(Array.isArray(userData?.assignments) ? userData.assignments : []),
            ...(Array.isArray(payload?.buildingAssignments) ? payload.buildingAssignments : []),
            ...(Array.isArray(userData?.buildingAccess) ? userData.buildingAccess : []),
            ...(Array.isArray(payload?.buildingAccess) ? payload.buildingAccess : []),
        ];
        assignments.forEach((assignment: any) => {
            const normalized = String(assignment?.type ?? assignment?.assignmentType ?? assignment?.role ?? '').toLowerCase().replace(/[\s-_]/g, '');
            if (normalized === 'buildingadmin' || normalized === 'buildingadministrator') {
                mapped.add('building_admin');
            } else if (normalized === 'manager') {
                mapped.add('manager');
            } else if (normalized === 'staff') {
                mapped.add('employee');
            }
        });
    }

    for (const role of ROLE_PRIORITY) {
        if (mapped.has(role)) return role;
    }
    if (mapped.size === 0) {
        return 'manager';
    }
    return 'admin';
}

export function buildBuildingAddress(data: any) {
    if (data?.address) return data.address;
    return [data?.city, data?.emirate, data?.country].filter(Boolean).join(", ");
}

export function resolveBuildingStatus(data: any): BuildingStatus {
    if (data?.status) return data.status;
    if (typeof data?.isActive === 'boolean') {
        return data.isActive ? 'active' : 'inactive';
    }
    return 'active';
}

export function mapAssignmentRole(type: any): BaseRole | null {
    const normalized = String(type || '').toLowerCase().replace(/[\s-_]/g, '');
    if (normalized === 'manager') return 'manager';
    if (normalized === 'staff') return 'employee';
    if (normalized === 'buildingadmin' || normalized === 'buildingadministrator') return 'building_admin';
    return null;
}

export function normalizeAssignmentUser(assignment: any, role: BaseRole, buildingId: string): User {
    const userData = assignment?.user ?? assignment?.assignee ?? assignment?.profile ?? assignment ?? {};
    return normalizeUserFromApi({
        ...userData,
        ...assignment,
        id: assignment?.userId ?? userData?.id ?? assignment?.id ?? Math.random(),
        role,
        baseRole: role,
        buildingAssignments: buildingId
            ? [{ buildingId, type: role === 'building_admin' ? 'BUILDING_ADMIN' : (role === 'employee' ? 'STAFF' : 'MANAGER') }]
            : undefined,
    }) as User;
}

export function normalizeResidentUser(resident: any, buildingId: string): User {
    const userData = resident?.user ?? resident ?? {};
    return normalizeUserFromApi({
        ...userData,
        ...resident,
        id: resident?.userId ?? userData?.id ?? resident?.id ?? Math.random(),
        role: 'tenant',
        baseRole: 'tenant',
        resident: {
            buildingId,
            unitId: resident?.unitId ?? resident?.unit?.id,
            unitLabel: resident?.unitLabel ?? resident?.unit?.label,
            status: resident?.status,
        },
    }) as User;
}

export function normalizeUser(u: any, role: BaseRole, buildingId?: string): User {
    return normalizeUserFromApi({
        ...u,
        role,
        baseRole: role,
        buildingIds: buildingId ? [buildingId] : u?.buildingIds,
    }) as User;
}

export const mapUser = (u: any, role: BaseRole): User => normalizeUser(u, role);
