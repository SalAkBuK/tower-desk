import type {
    BaseRole,
    Broadcast,
    BuildingStatus,
    Conversation,
    ConversationMessage,
    ConversationParticipant,
    NotificationItem,
    OccupancyResponseDto,
    RequestAttachment,
    RequestComment,
    RequestPriority,
    RequestStatus,
    RequestUnit,
    ServiceRequest,
    User
} from '../types';

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
    const normalized = String(value || 'medium').toLowerCase();
    if (normalized === 'urgent') return 'urgent';
    return normalized as RequestPriority;
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
    return {
        id: String(item?.id ?? item?.notificationId ?? item?._id ?? ''),
        type: item?.type ?? item?.eventType ?? '',
        title: item?.title ?? item?.subject ?? 'Notification',
        body: item?.body ?? item?.message ?? item?.content,
        data: item?.data ?? item?.payload,
        readAt: item?.readAt ?? item?.read_at ?? null,
        createdAt: item?.createdAt ?? item?.created_at ?? item?.timestamp
    };
}

export function mapBroadcast(item: any): Broadcast {
    const rawBuildingIds = item?.buildingIds ?? item?.building_ids ?? item?.buildings ?? [];
    const buildingIds = Array.isArray(rawBuildingIds)
        ? rawBuildingIds.map((entry) => String(entry?.id ?? entry))
        : [];
    const sender = item?.sender ?? item?.createdBy ?? item?.user ?? {};
    const senderId = sender?.id ?? item?.senderUserId ?? item?.senderId ?? '';
    return {
        id: String(item?.id ?? item?.broadcastId ?? item?._id ?? ''),
        title: String(item?.title ?? ''),
        body: item?.body ?? item?.message ?? item?.content ?? undefined,
        buildingIds,
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
        avatarUrl: participant?.avatarUrl ?? participant?.avatar ?? participant?.photoUrl ?? null
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

export function mapConversation(item: any): Conversation {
    const participantsRaw = item?.participants ?? item?.members ?? item?.users ?? [];
    const messagesRaw = item?.messages ?? item?.messageHistory ?? [];
    const lastMessageRaw = item?.lastMessage ?? item?.last_message ?? (Array.isArray(messagesRaw) ? messagesRaw[0] : null);
    return {
        id: String(item?.id ?? item?.conversationId ?? item?._id ?? ''),
        subject: item?.subject ?? item?.title ?? null,
        buildingId: item?.buildingId ?? item?.building_id ?? null,
        participants: Array.isArray(participantsRaw) ? participantsRaw.map(mapConversationParticipant) : [],
        unreadCount: Number(item?.unreadCount ?? item?.unread_count ?? item?.unread ?? 0),
        lastMessage: lastMessageRaw ? mapConversationMessage(lastMessageRaw) : null,
        messages: Array.isArray(messagesRaw) ? messagesRaw.map(mapConversationMessage) : undefined,
        createdAt: String(item?.createdAt ?? item?.created_at ?? new Date().toISOString()),
        updatedAt: String(item?.updatedAt ?? item?.updated_at ?? item?.createdAt ?? item?.created_at ?? new Date().toISOString())
    };
}

export const ROLE_PRIORITY: BaseRole[] = ['superadmin', 'admin', 'org_admin', 'manager', 'service_provider', 'employee', 'tenant'];
export const BASE_ROLE_KEYS = new Set<BaseRole>(ROLE_PRIORITY);

export const isBaseRoleKey = (value: string): value is BaseRole => BASE_ROLE_KEYS.has(value as BaseRole);

export function mapRoleValue(value: string): BaseRole | null {
    const normalized = value.toLowerCase().replace(/[\s-_]/g, '');
    if (['superadmin', 'super', 'superuser', 'platformadmin', 'platform', 'root', 'towerdesk'].includes(normalized)) {
        return 'superadmin';
    }
    if (['orgadmin', 'organizationadmin', 'orgowner'].includes(normalized)) {
        return 'org_admin';
    }
    if (['admin', 'owner', 'buildingadmin', 'buildingadministrator'].includes(normalized)) {
        return 'admin';
    }
    if (['manager', 'buildingmanager'].includes(normalized)) {
        return 'manager';
    }
    if (['serviceprovider', 'service_provider'].includes(normalized)) {
        return 'service_provider';
    }
    if (['employee', 'staff', 'maintenance', 'maintenancestaff', 'technician', 'worker'].includes(normalized)) {
        return 'employee';
    }
    if (['tenant', 'resident', 'occupant'].includes(normalized)) {
        return 'tenant';
    }
    return null;
}

export function resolveRole(userData: any, payload?: any): BaseRole {
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

    pushCandidate(userData?.role);
    pushCandidate(userData?.roleName);
    pushCandidate(userData?.userType);
    pushCandidate(userData?.type);
    pushCandidate(payload?.role);
    pushCandidate(payload?.roleName);
    pushCandidateList(userData?.orgRoleKeys);
    pushCandidateList(userData?.roleKeys);
    pushCandidateList(payload?.orgRoleKeys);
    pushCandidateList(payload?.roleKeys);

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
        ];
        assignments.forEach((assignment: any) => {
            const normalized = String(assignment?.type ?? assignment?.assignmentType ?? assignment?.role ?? '').toLowerCase().replace(/[\s-_]/g, '');
            if (normalized === 'buildingadmin' || normalized === 'buildingadministrator') {
                mapped.add('admin');
            } else if (normalized === 'manager') {
                mapped.add('manager');
            } else if (normalized === 'staff') {
                mapped.add('employee');
            }
        });
    }

    if (mapped.size === 0 && (userData?.orgId === null || payload?.orgId === null)) {
        return 'superadmin';
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
    if (normalized === 'buildingadmin' || normalized === 'buildingadministrator') return 'admin';
    return null;
}

export function normalizeAssignmentUser(assignment: any, role: BaseRole, buildingId: string): User {
    const userData = assignment?.user ?? assignment?.assignee ?? assignment?.profile ?? assignment ?? {};
    const id = assignment?.userId ?? userData?.id ?? assignment?.id ?? Math.random();
    const fullName = userData?.fullName ?? assignment?.name ?? userData?.name;
    return {
        id: String(id),
        name: fullName || userData?.email || 'Unknown',
        email: userData?.email ?? assignment?.email ?? '',
        role,
        baseRole: role,
        buildingIds: buildingId ? [buildingId] : [],
        orgId: userData?.orgId ?? assignment?.orgId ?? null,
        orgRoleKeys: userData?.orgRoleKeys ?? userData?.roleKeys ?? assignment?.orgRoleKeys ?? assignment?.roleKeys,
        roleKeys: userData?.roleKeys ?? assignment?.roleKeys,
        isActive: typeof userData?.isActive === 'boolean' ? userData.isActive : undefined,
        fullName,
        phoneNumber: userData?.phoneNumber ?? userData?.phone,
        address: userData?.address,
        nationality: userData?.nationality
    };
}

export function normalizeResidentUser(resident: any, buildingId: string): User {
    const userData = resident?.user ?? resident ?? {};
    const id = resident?.userId ?? userData?.id ?? resident?.id ?? Math.random();
    const fullName = userData?.fullName ?? resident?.name ?? userData?.name;
    const mustChangePasswordValue =
        resident?.mustChangePassword ??
        resident?.must_change_password ??
        userData?.mustChangePassword ??
        userData?.must_change_password;
    return {
        id: String(id),
        name: fullName || userData?.email || 'Resident',
        email: resident?.email ?? userData?.email ?? '',
        role: 'tenant',
        baseRole: 'tenant',
        buildingIds: buildingId ? [buildingId] : [],
        orgId: resident?.orgId ?? userData?.orgId ?? null,
        orgRoleKeys: userData?.orgRoleKeys ?? userData?.roleKeys ?? resident?.orgRoleKeys ?? resident?.roleKeys,
        roleKeys: userData?.roleKeys ?? resident?.roleKeys,
        isActive: typeof resident?.isActive === 'boolean'
            ? resident.isActive
            : (typeof userData?.isActive === 'boolean' ? userData.isActive : undefined),
        mustChangePassword: typeof mustChangePasswordValue === 'boolean' ? mustChangePasswordValue : undefined,
        fullName,
        phoneNumber: userData?.phoneNumber ?? userData?.phone,
        address: userData?.address,
        nationality: userData?.nationality,
        createdAt: resident?.createdAt ?? userData?.createdAt ?? userData?.created_at
    };
}

export function normalizeUser(u: any, role: BaseRole, buildingId?: string): User {
    const mustChangePasswordValue = u?.mustChangePassword ?? u?.must_change_password;
    return {
        id: String(u.id || Math.random()),
        name: u.fullName || u.name || 'Unknown',
        email: u.email || '',
        role,
        baseRole: role,
        buildingIds: buildingId ? [buildingId] : [],
        orgRoleKeys: u.orgRoleKeys ?? u.roleKeys,
        roleKeys: u.roleKeys,
        isActive: typeof u.isActive === 'boolean' ? u.isActive : undefined,
        mustChangePassword: typeof mustChangePasswordValue === 'boolean' ? mustChangePasswordValue : undefined,
        fullName: u.fullName,
        phoneNumber: u.phoneNumber,
        address: u.address,
        nationality: u.nationality,
        createdAt: u.createdAt ?? u.created_at
    };
}

export const mapUser = (u: any, role: BaseRole): User => normalizeUser(u, role);
