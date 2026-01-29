import { Building, BuildingAssignment, BuildingResident, BuildingOccupancy, BuildingStatus, BuildingUnit, RequestStatus, RequestPriority, RequestAttachment, RequestComment, RequestUnit, ServiceRequest, User, Role, BaseRole, AdminDTO, BuildingDTO, PlatformOrg, PlatformOrgAdmin, NotificationItem, Broadcast, BroadcastListResponse, CreateBroadcastInput, Conversation, ConversationListResponse, ConversationMessage, ConversationParticipant, CreateConversationInput, OrgProfile, OrgBusinessType, UnitType, Owner, Amenity, MaintenancePayer, UnitSizeUnit, KitchenType, FurnishedStatus, PaymentFrequency, PermissionOverride, RoleDefinition, PermissionDefinition, UserEffectivePermissions, ParkingSlot, ParkingSlotType, ParkingAllocation, Vehicle, Visitor, VisitorType, VisitorStatus, UnitsImportMode, UnitsImportResponse, ParkingSlotsImportMode, ParkingSlotsImportResponse, OccupancyResponseDto,OccupancyUnitDto,OccupancyResidentDto } from './types';
import { DEBUG_AUTH, logAuth } from './debugAuth';
import { useAuthStore } from './auth';

const DELAY_MS = 800;
const IS_DEV = process.env.NODE_ENV !== 'production';

const resolveApiBase = () => {
    const envBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!envBase) {
        // Never fall back to /api; the frontend must talk directly to the backend.
        throw new Error('Missing NEXT_PUBLIC_API_BASE_URL (e.g. http://localhost:3001/api)');
    }
    const trimmed = envBase.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) {
        // Guard against accidental /api or relative values.
        throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute http(s) URL');
    }
    return trimmed;
};

const API_BASE_URL = resolveApiBase();
let didLogApiBase = false;
if (IS_DEV && typeof window !== 'undefined' && !didLogApiBase) {
    didLogApiBase = true;
    console.log(`[API] Base URL: ${API_BASE_URL}`);
}

// Toggle this to false to try connecting to real API
const USE_MOCK = false;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const PUBLIC_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/health'];
let supportsEffectivePermissionsEndpoint = true;

const isPublicEndpoint = (endpoint: string) => {
    const normalized = endpoint.toLowerCase();
    return PUBLIC_ENDPOINTS.some((path) => normalized.startsWith(path));
};

const getPermissionSet = (user?: User | null) => {
    const keys = [
        ...(user?.roleKeys ?? []),
        ...(user?.orgRoleKeys ?? []),
        ...(user?.effectivePermissions ?? []),
    ].map((key) => String(key).toLowerCase());
    return new Set(keys);
};

function truncateForLog(value: unknown, max = 800) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    if (text.length <= max) return text;
    return `${text.slice(0, max)}...`;
}

function resolveAccessToken(primary?: any, fallback?: any): string | null {
    return (
        primary?.accessToken ??
        primary?.access_token ??
        primary?.token ??
        fallback?.accessToken ??
        fallback?.access_token ??
        fallback?.token ??
        null
    );
}

function resolveRefreshToken(primary?: any, fallback?: any): string | null {
    return (
        primary?.refreshToken ??
        primary?.refresh_token ??
        fallback?.refreshToken ??
        fallback?.refresh_token ??
        null
    );
}

function buildFriendlyErrorMessage(status: number, errorBody: string, contentType: string | null) {
    const isHtml = Boolean(contentType?.includes('text/html')) || /<\s*(?:!doctype|html|head|body)\b/i.test(errorBody);
    if (isHtml) {
        if (/inactivity timeout/i.test(errorBody)) {
            return 'Request timed out due to inactivity. Please try again.';
        }
        return 'Unexpected server response. Please try again.';
    }
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'Requested resource was not found.';
    if (status >= 500) return 'Server error. Please try again in a moment.';
    return `API Error: ${status}`;
}

function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = typeof atob === 'function'
            ? atob(normalized)
            : Buffer.from(normalized, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

// --- Mock Data ---

const MOCK_BUILDINGS: Building[] = [
    { id: 'b1', name: 'Tower One', address: '100 Main St, New York, NY', status: 'active', stats: { totalTenants: 120, activeRequests: 5, occupancyRate: 0.95 } },
    { id: 'b2', name: 'Skyline Heights', address: '200 High Ave, San Francisco, CA', status: 'active', stats: { totalTenants: 85, activeRequests: 12, occupancyRate: 0.88 } },
    { id: 'b3', name: 'The Vertex', address: '300 Peak Rd, Austin, TX', status: 'maintenance', stats: { totalTenants: 40, activeRequests: 2, occupancyRate: 0.60 } },
    { id: 'b4', name: 'Oceanview Plaza', address: '400 Shore Blvd, Miami, FL', status: 'active', stats: { totalTenants: 200, activeRequests: 8, occupancyRate: 0.98 } },
];

// Initial Mock Users
let MOCK_USERS: User[] = [
    { id: 'u1', name: 'Alice Super', email: 'alice@towerdesk.com', role: 'superadmin', baseRole: 'superadmin', buildingIds: [], fullName: 'Alice Superadmin', phoneNumber: '1234567890', address: 'Admin HQ', nationality: 'US' },
    { id: 'u2', name: 'Bob Admin', email: 'bob@towerdesk.com', role: 'admin', baseRole: 'admin', buildingIds: ['b1', 'b2'], fullName: 'Bob Administrator', phoneNumber: '0987654321', address: 'Site B', nationality: 'CA' },
    { id: 'u3', name: 'Charlie Manager', email: 'charlie@towerdesk.com', role: 'manager', baseRole: 'manager', buildingIds: ['b1'], fullName: 'Charlie Manager', phoneNumber: '5551234567', address: 'Site A', nationality: 'US' },
    { id: 'u4', name: 'David Tenant', email: 'david@tenant.com', role: 'tenant', baseRole: 'tenant', buildingIds: ['b1'], fullName: 'David Tenant', phoneNumber: '5559876543', address: 'Unit 101', nationality: 'US' },
    { id: 'u5', name: 'Eve Employee', email: 'eve@maintenance.com', role: 'employee', baseRole: 'employee', buildingIds: ['b1', 'b2', 'b3', 'b4'], fullName: 'Eve Fixit', phoneNumber: '5556667777', address: 'Service HQ', nationality: 'MX' },
    { id: 'u6', name: 'Frank Admin', email: 'frank@towerdesk.com', role: 'admin', baseRole: 'admin', buildingIds: ['b3', 'b4'], fullName: 'Frank Admin', phoneNumber: '5554443333', address: 'Site C', nationality: 'US' },
];

const MOCK_REQUESTS: ServiceRequest[] = [
    {
        id: 'r1',
        title: 'Leaking Faucet in 101',
        description: 'The kitchen faucet is dripping constantly.',
        status: 'pending',
        priority: 'medium',
        buildingId: 'b1',
        createdByTenantId: 'u4',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
        id: 'r2',
        title: 'AC Not Working',
        description: 'Unit 305 is extremely hot, AC blowing warm air.',
        priority: 'high',
        buildingId: 'b1',
        createdByTenantId: 'u4',
        assignedEmployeeId: 'u5',
        status: 'in-progress',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
        id: 'r3',
        title: 'Elevator Noise',
        description: 'Strange grinding noise in service elevator.',
        status: 'assigned',
        priority: 'urgent',
        buildingId: 'b2',
        createdByTenantId: 'u2', // Admin created
        assignedEmployeeId: 'u5',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    }
];

// --- Helpers ---

async function refreshSession(): Promise<string | null> {
    const { refreshToken, user } = useAuthStore.getState();
    if (!refreshToken) return null;
    try {
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_start', { hasRefreshToken: Boolean(refreshToken), userId: user?.id ?? null });
        }
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
            },
            body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
            if (DEBUG_AUTH) {
                logAuth('AUTH', `refresh_failed status=${res.status}`);
            }
            return null;
        }
        const data = await res.json();
        const payload = data?.data ?? data;
        const nextAccessToken = resolveAccessToken(payload, data);
        if (!nextAccessToken) return null;
        const nextRefreshToken = resolveRefreshToken(payload, data) ?? refreshToken;
        const nextUser = payload?.user ?? user;
        useAuthStore.setState({
            token: nextAccessToken,
            refreshToken: nextRefreshToken,
            user: nextUser ?? user,
            isAuthenticated: Boolean(nextUser ?? user),
        });
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_success', { userId: nextUser?.id ?? user?.id ?? null });
        }
        return nextAccessToken;
    } catch (e) {
        if (IS_DEV) {
            console.warn('[API] Refresh failed', e);
        }
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'refresh_error', { error: e instanceof Error ? e.message : String(e) });
        }
        return null;
    }
}

async function fetchJson(
    endpoint: string,
    options?: RequestInit,
    config?: { retryOnUnauthorized?: boolean; silentStatusCodes?: number[] }
) {
    if (USE_MOCK) return null;
    const retryOnUnauthorized = config?.retryOnUnauthorized ?? true;
    try {
        if (IS_DEV) {
            console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
        }
        const { token, refreshToken, user, selectedOrgId } = useAuthStore.getState();
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
        const isOrgEndpoint = normalizedEndpoint.startsWith('/org/') || normalizedEndpoint.startsWith('/notifications');
        const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
        const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'accept': '*/*',
                ...(shouldAttachAuth ? { Authorization: `Bearer ${token}` } : {}),
                ...(shouldAttachOrg ? { 'x-org-id': String(activeOrgId) } : {}),
                ...options?.headers,
            },
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        if (DEBUG_AUTH && (endpoint.startsWith('/auth') || endpoint.startsWith('/users/me') || endpoint.startsWith('/org/users'))) {
            logAuth('API', `${options?.method || 'GET'} ${endpoint} status=${res.status}`);
        }
        if (res.status === 403 && IS_DEV) {
            const payload = token ? decodeJwtPayload(token) : null;
            console.warn("[API] 403 Forbidden", {
                endpoint,
                method: options?.method || 'GET',
                hasToken: Boolean(token),
                tokenOrgId: payload?.orgId ?? null,
                tokenRole: payload?.role ?? null,
                tokenRoles: payload?.roles ?? null,
                tokenPermissions: payload?.permissions ?? payload?.perms ?? null,
            });
        }
        if (DEBUG_AUTH && res.status >= 400) {
            const payload = token ? decodeJwtPayload(token) : null;
            logAuth('API', `error status=${res.status} ${endpoint}`, {
                method: options?.method || 'GET',
                hasToken: Boolean(token),
                role: user?.role ?? null,
                orgId: selectedOrgId ?? user?.orgId ?? null,
                tokenRole: payload?.role ?? null,
                tokenRoles: payload?.roles ?? null,
                tokenOrgId: payload?.orgId ?? null,
                tokenPermissions: payload?.permissions ?? payload?.perms ?? null,
            });
        }
        if (res.status === 401) {
            const canRefresh = Boolean(refreshToken) && !isPublicEndpoint(endpoint);
            if (retryOnUnauthorized && canRefresh) {
                const refreshed = await refreshSession();
                if (refreshed) {
                    return fetchJson(endpoint, options, { retryOnUnauthorized: false });
                }
                useAuthStore.getState().logout();
            } else if (shouldAttachAuth) {
                useAuthStore.getState().logout();
            }
        }
        if (!res.ok) {
            let errorBody = '';
            try {
                errorBody = await res.text();
            } catch {
                errorBody = '';
            }
            const silentStatusCodes = config?.silentStatusCodes ?? [];
            const shouldSilence = silentStatusCodes.includes(res.status);
            if (IS_DEV && !shouldSilence) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                if (errorBody) {
                    console.error(`[API] Error Body:`, errorBody);
                }
            }
            if (DEBUG_AUTH && errorBody && !shouldSilence) {
                logAuth('API', `error_body status=${res.status} ${endpoint}`, {
                    body: truncateForLog(errorBody)
                });
            }
            const contentType = res.headers.get('content-type');
            let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
            if (errorBody && /API Error:/i.test(errorMessage)) {
                try {
                    const parsed = JSON.parse(errorBody);
                    const parsedMessage =
                        parsed?.message ??
                        parsed?.error?.message ??
                        parsed?.error?.detail ??
                        parsed?.error?.error ??
                        parsed?.data?.message ??
                        parsed?.data?.error?.message;
                    if (parsedMessage) {
                        errorMessage = parsedMessage;
                    }
                } catch {
                    // Keep the friendly message for non-JSON errors.
                }
            }
            const error = new Error(errorMessage) as Error & { silent?: boolean };
            if (shouldSilence) {
                error.silent = true;
            }
            throw error;
        }
        const data = await res.json();
        if (IS_DEV) {
            console.log(`[API] Data received for ${endpoint}`);
        }
        return data;
    } catch (e) {
        const error = e as { silent?: boolean };
        if (!error?.silent) {
            console.error("[API] Fetch failed", e);
        }
        throw e;
    }
}

// --- API Functions ---

function redactLoginPayload(payload: any) {
    if (!payload || typeof payload !== 'object') return payload;
    const clone = { ...payload };
    if ('accessToken' in clone) clone.accessToken = '[redacted]';
    if ('access_token' in clone) clone.access_token = '[redacted]';
    if ('token' in clone) clone.token = '[redacted]';
    if ('refreshToken' in clone) clone.refreshToken = '[redacted]';
    if ('refresh_token' in clone) clone.refresh_token = '[redacted]';
    return clone;
}

// Helper to unwrap API response
function getArray(res: any): any[] {
    if (!res) return [];
    if (Array.isArray(res)) return res;
    if (res.items && Array.isArray(res.items)) return res.items;
    if (res.data?.items && Array.isArray(res.data.items)) return res.data.items;
    if (res.data && Array.isArray(res.data)) return res.data;
    return [];
}

function mapRequestStatus(value: any): RequestStatus {
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

function mapRequestStatusToApi(status: RequestStatus): number {
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

function mapRequestStatusToApiStatus(status: RequestStatus): string {
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
function mapOccupancyResponseDto(entry: any): OccupancyResponseDto {
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


function mapRequestPriority(value: any): RequestPriority {
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

function mapRequestAttachments(data: any): RequestAttachment[] {
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

function mapRequestUnit(data: any): RequestUnit | undefined {
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

function mapRequestCreator(data: any): ServiceRequest['createdBy'] | undefined {
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

function mapRequestComment(comment: any): RequestComment {
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

function mapNotification(item: any): NotificationItem {
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

function mapBroadcast(item: any): Broadcast {
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

function mapConversationParticipant(participant: any): ConversationParticipant {
    return {
        id: String(participant?.id ?? participant?.userId ?? participant?._id ?? ''),
        name: participant?.name ?? participant?.fullName ?? participant?.displayName ?? undefined,
        avatarUrl: participant?.avatarUrl ?? participant?.avatar ?? participant?.photoUrl ?? null
    };
}

function mapConversationMessage(message: any): ConversationMessage {
    const sender = message?.sender ?? message?.user ?? message?.createdBy ?? {};
    return {
        id: String(message?.id ?? message?.messageId ?? message?._id ?? ''),
        content: String(message?.content ?? message?.body ?? message?.message ?? ''),
        sender: mapConversationParticipant(sender),
        createdAt: String(message?.createdAt ?? message?.created_at ?? message?.timestamp ?? new Date().toISOString())
    };
}

function mapConversation(item: any): Conversation {
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

const ROLE_PRIORITY: BaseRole[] = ['superadmin', 'admin', 'org_admin', 'manager', 'service_provider', 'employee', 'tenant'];
const BASE_ROLE_KEYS = new Set<BaseRole>(ROLE_PRIORITY);

const isBaseRoleKey = (value: string): value is BaseRole => BASE_ROLE_KEYS.has(value as BaseRole);

function mapRoleValue(value: string): BaseRole | null {
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

function resolveRole(userData: any, payload?: any): BaseRole {
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

function buildBuildingAddress(data: any) {
    if (data?.address) return data.address;
    return [data?.city, data?.emirate, data?.country].filter(Boolean).join(", ");
}

function resolveBuildingStatus(data: any): BuildingStatus {
    if (data?.status) return data.status;
    if (typeof data?.isActive === 'boolean') {
        return data.isActive ? 'active' : 'inactive';
    }
    return 'active';
}

function mapAssignmentRole(type: any): BaseRole | null {
    const normalized = String(type || '').toLowerCase().replace(/[\s-_]/g, '');
    if (normalized === 'manager') return 'manager';
    if (normalized === 'staff') return 'employee';
    if (normalized === 'buildingadmin' || normalized === 'buildingadministrator') return 'admin';
    return null;
}

function normalizeAssignmentUser(assignment: any, role: BaseRole, buildingId: string): User {
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

function normalizeResidentUser(resident: any, buildingId: string): User {
    const userData = resident?.user ?? resident ?? {};
    const id = resident?.userId ?? userData?.id ?? resident?.id ?? Math.random();
    const fullName = userData?.fullName ?? resident?.name ?? userData?.name;
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
        fullName,
        phoneNumber: userData?.phoneNumber ?? userData?.phone,
        address: userData?.address,
        nationality: userData?.nationality
    };
}

function normalizeUser(u: any, role: BaseRole, buildingId?: string): User {
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
        fullName: u.fullName,
        phoneNumber: u.phoneNumber,
        address: u.address,
        nationality: u.nationality
    };
}

export async function getBuildings(): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (role === 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping org buildings for superadmin');
                }
                return [];
            }
            const res = await fetchJson('/org/buildings');
            const buildings = getArray(res);
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch buildings failed", e);
            return [];
        }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS;
}

export async function getBuildingsForAdmin(adminId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            // Admins often lack org-wide permissions; prefer assigned buildings to avoid 403s.
            const endpoint = role === 'admin' ? '/org/buildings/assigned' : '/org/buildings';
            const res = await fetchJson(endpoint);
            const buildings = getArray(res);
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch admin buildings failed", e);
            return [];
        }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS;
}

export async function getBuildingsForManager(managerId: string): Promise<Building[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/org/buildings/assigned');
            const buildings = getArray(res);
            return buildings.map((b: any) => ({
                id: String(b.id ?? b.buildingId),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            }));
        } catch (e) {
            console.warn("Fetch manager buildings failed", e);
            return [];
        }
    }
    await delay(DELAY_MS);
    return MOCK_BUILDINGS.slice(0, 1);
}

export async function getBuilding(id: string): Promise<Building | undefined> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/org/buildings/${id}`);
            const b = res?.data || res;
            if (!b) return undefined;
            return {
                id: String(b.id ?? b.buildingId ?? id),
                name: b.name ?? 'Building',
                address: buildBuildingAddress(b),
                city: b.city,
                emirate: b.emirate,
                country: b.country,
                timezone: b.timezone,
                floors: b.floors,
                unitsCount: b.unitsCount ?? b.unintsCount,
                status: resolveBuildingStatus(b),
                stats: {
                    totalTenants: b.unitsCount || b.unintsCount || 0,
                    activeRequests: 0,
                    occupancyRate: 0
                }
            };
        } catch (e) {
            console.warn("Fetch building failed", e);
        }
    }
    const buildings = await getBuildings();
    return buildings.find((b) => b.id === id);
}


// Helper to map API user data to our User type
const mapUser = (u: any, role: BaseRole): User => normalizeUser(u, role);

// Consolidated getUsers fetching from all user endpoints
export async function getUsers(): Promise<User[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getUsers for non-superadmin role');
                }
                return [];
            }
            const [adminsRes, staffRes, managersRes, tenantsRes] = await Promise.all([
                fetchJson('/Admin/getall').catch(() => []),
                fetchJson('/MaintenanceStaff/getall').catch(() => []),
                fetchJson('/Manager/getall').catch(() => []),
                fetchJson('/Tenant/getall').catch(() => [])
            ]);

            const admins = getArray(adminsRes);
            const staff = getArray(staffRes);
            const managers = getArray(managersRes);
            const tenants = getArray(tenantsRes);

            return [
                ...admins.map((u: any) => mapUser(u, 'admin')),
                ...staff.map((u: any) => mapUser(u, 'employee')),
                ...managers.map((u: any) => mapUser(u, 'manager')),
                ...tenants.map((u: any) => mapUser(u, 'tenant'))
            ].sort((a, b) => Number(b.id) - Number(a.id));
        } catch (e) {
            console.warn("Falling back to mock users due to API error", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_USERS;
}

export async function setUserPermissionOverrides(userId: string, overrides: PermissionOverride[]): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ overrides })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function getUserPermissionOverrides(userId: string): Promise<PermissionOverride[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/permissions`);
        const payload = res?.data ?? res ?? {};
        const overrides = payload.overrides ?? payload.permissions ?? payload.items ?? [];
        return Array.isArray(overrides) ? overrides : [];
    }
    await delay(DELAY_MS);
    return [];
}

export async function getEffectivePermissions(userIds: string[]): Promise<UserEffectivePermissions[]> {
    if (userIds.length === 0) return [];
    if (!supportsEffectivePermissionsEndpoint) return [];
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/users/effective-permissions', {
                method: 'POST',
                body: JSON.stringify({ userIds })
            }, { silentStatusCodes: [404] });
            const payload = res?.data ?? res ?? {};
            const users = payload.users ?? payload.items ?? payload ?? [];
            if (!Array.isArray(users)) return [];
            return users.map((entry: any) => ({
                userId: String(entry.userId ?? entry.id ?? ''),
                permissions: Array.isArray(entry.permissions) ? entry.permissions : []
            })).filter((entry) => entry.userId);
        } catch (error) {
            if (error instanceof Error && /not found/i.test(error.message)) {
                supportsEffectivePermissionsEndpoint = false;
                return [];
            }
            throw error;
        }
    }
    await delay(DELAY_MS);
    return [];
}

export async function getPermissions(): Promise<PermissionDefinition[]> {
    if (!USE_MOCK) {
        const res = await fetchJson('/permissions');
        const permissions = getArray(res);
        return permissions.map((permission: any) => ({
            key: String(permission.key ?? permission.permissionKey ?? permission.name ?? ''),
            name: permission.name ?? permission.displayName ?? undefined,
            description: permission.description ?? permission.desc ?? undefined
        })).filter((permission) => permission.key);
    }
    await delay(DELAY_MS);
    return [];
}

export async function getRoles(): Promise<RoleDefinition[]> {
    if (!USE_MOCK) {
        const res = await fetchJson('/roles');
        const roles = getArray(res);
        return roles.map((role: any) => ({
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? role.name ?? ''),
            key: String(role.key ?? role.name ?? role.id ?? ''),
            name: role.name ?? role.displayName ?? role.key ?? 'Role',
            description: role.description ?? role.desc ?? undefined,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function getUserRoles(userId?: string | null): Promise<RoleDefinition[]> {
    if (!USE_MOCK) {
        const currentUserId = useAuthStore.getState().user?.id;
        const isSelf = userId && currentUserId && String(userId) === String(currentUserId);
        const endpoint = userId && !isSelf ? `/users/${userId}/roles` : '/users/me/roles';
        let res: any;
        try {
            res = await fetchJson(endpoint, undefined, userId && !isSelf ? { silentStatusCodes: [404] } : undefined);
        } catch (error) {
            if (userId && !isSelf && error instanceof Error && /not found/i.test(error.message)) {
                return [];
            }
            throw error;
        }
        const payload = res?.data ?? res ?? {};
        const roles = Array.isArray(payload?.roles) ? payload.roles : getArray(payload);
        return roles.map((role: any) => ({
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? role.name ?? ''),
            key: String(role.key ?? role.name ?? role.id ?? ''),
            name: role.name ?? role.displayName ?? role.key ?? 'Role',
            description: role.description ?? role.desc ?? undefined,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function setUserRoles(userId: string, payload: { roleIds: string[]; mode?: 'replace' | 'add' }) {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}/roles`, {
            method: 'POST',
            body: JSON.stringify({ roleIds: payload.roleIds, mode: payload.mode ?? 'replace' })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function createRole(payload: { key: string; name: string; description?: string }): Promise<RoleDefinition> {
    if (!USE_MOCK) {
        const res = await fetchJson('/roles', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const role = res?.data ?? res ?? payload;
        return {
            id: String(role.id ?? role.roleId ?? role._id ?? role.key ?? payload.key),
            key: String(role.key ?? payload.key),
            name: role.name ?? payload.name,
            description: role.description ?? payload.description,
            permissionKeys: role.permissionKeys ?? role.permissions ?? role.perms ?? undefined
        };
    }
    await delay(DELAY_MS);
    return {
        id: payload.key,
        key: payload.key,
        name: payload.name,
        description: payload.description,
        permissionKeys: []
    };
}

export async function setRolePermissions(
    roleId: string,
    permissionKeys: string[],
    mode: 'add' | 'replace' = 'add'
): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/roles/${roleId}/permissions`, {
            method: 'POST',
            body: JSON.stringify({ permissionKeys, mode })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function getUsersForAdminBuildings(buildingIds: string[]): Promise<User[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            let orgUsers: any[] = [];
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            const shouldLoadOrgUsers = role === 'superadmin' || role === 'admin' || role === 'org_admin';
            if (shouldLoadOrgUsers) {
                try {
                    const orgUsersRes = await fetchJson('/org/users');
                    orgUsers = getArray(orgUsersRes);
                } catch (err) {
                    if (IS_DEV) {
                        console.warn('[API] Failed to load /org/users, falling back to assignments/residents.', err);
                    }
                    orgUsers = [];
                }
            }

            const results = await Promise.all(buildingIds.map(async (buildingId) => {
                const [assignmentsRes, residentsRes] = await Promise.all([
                    fetchJson(`/org/buildings/${buildingId}/assignments`).catch(() => []),
                    fetchJson(`/org/buildings/${buildingId}/residents`).catch(() => [])
                ]);
                return {
                    buildingId,
                    assignments: getArray(assignmentsRes),
                    residents: getArray(residentsRes)
                };
            }));

            const roleMap = new Map<string, { roles: Set<BaseRole>; buildingIds: Set<string> }>();
            const assignmentUsers = new Map<string, User>();
            const remember = (userId: string, role: BaseRole, buildingId: string) => {
                const key = String(userId);
                const entry = roleMap.get(key) ?? { roles: new Set<BaseRole>(), buildingIds: new Set<string>() };
                entry.roles.add(role);
                if (buildingId) entry.buildingIds.add(String(buildingId));
                roleMap.set(key, entry);
            };

            results.forEach(({ buildingId, assignments, residents }) => {
                assignments.forEach((assignment: any) => {
                    const role = mapAssignmentRole(assignment?.type ?? assignment?.assignmentType ?? assignment?.role);
                    if (!role) return;
                    const userId = assignment?.userId ?? assignment?.user?.id ?? assignment?.id;
                    if (userId) {
                        remember(userId, role, String(buildingId));
                    }
                    const normalized = normalizeAssignmentUser(assignment, role, String(buildingId));
                    assignmentUsers.set(String(normalized.id), normalized);
                });
                residents.forEach((resident: any) => {
                    const userId = resident?.userId ?? resident?.user?.id ?? resident?.id;
                    if (userId) {
                        remember(userId, 'tenant', String(buildingId));
                    }
                    const normalized = normalizeResidentUser(resident, String(buildingId));
                    assignmentUsers.set(String(normalized.id), normalized);
                });
            });

            const pickRole = (roles: Set<BaseRole>, fallback: BaseRole): BaseRole => {
                for (const role of ROLE_PRIORITY) {
                    if (roles.has(role)) return role;
                }
                return fallback;
            };

            if (orgUsers.length === 0) {
                return Array.from(assignmentUsers.values());
            }

            const users = orgUsers.map((user: any) => {
                const id = String(user.id ?? user.userId ?? '');
                const nameFromParts = [user.firstName, user.lastName].filter(Boolean).join(' ');
                const fullName = user.name ?? user.fullName ?? nameFromParts;
                const displayName = fullName || user.email?.split('@')[0] || 'User';
                const baseRole = resolveRole(user, { orgId: user.orgId ?? null });
                const orgRoleKeys = user.orgRoleKeys ?? user.roleKeys ?? [];
                const roleKeys = user.roleKeys ?? [];
                const info = roleMap.get(id);
                const baseRoleResolved = info ? pickRole(info.roles, baseRole) : baseRole;
                const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? baseRoleResolved);
                const buildingIds = info ? Array.from(info.buildingIds) : [];
                return {
                    id,
                    name: displayName,
                    email: user.email ?? '',
                    role: displayRole,
                    baseRole: baseRoleResolved,
                    buildingIds,
                    orgId: user.orgId ?? null,
                    orgRoleKeys,
                    roleKeys,
                    fullName,
                    phoneNumber: user.phone ?? user.phoneNumber,
                    address: user.address,
                    nationality: user.nationality,
                    avatarUrl: user.avatarUrl ?? user.avatar
                } as User;
            });

            const knownIds = new Set(users.map((user) => user.id));
            assignmentUsers.forEach((user, id) => {
                if (!knownIds.has(id)) {
                    users.push(user);
                }
            });

            return users;
        } catch (e) {
            console.warn("Fetch admin-scoped users failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_USERS;
}

export async function getRequests(buildingId?: string): Promise<ServiceRequest[]> {
    if (!USE_MOCK) {
        try {
            const role = useAuthStore.getState().user?.baseRole ?? useAuthStore.getState().user?.role;
            if (!buildingId && role && role !== 'superadmin') {
                if (IS_DEV) {
                    console.warn('[API] Skipping getRequests(all) for non-superadmin role');
                }
                return [];
            }
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests`)
                : await fetchJson('/MaintenanceRequest/all');
            const data = getArray(res);
            return data.map((r: any) => {
                const requestData = r?.request ?? r?.item ?? r?.data ?? r;
                    return {
                        id: String(requestData.id ?? r.id),
                        title: requestData.title || 'Service Request',
                        description: requestData.description || '',
                        status: mapRequestStatus(requestData.status),
                        priority: mapRequestPriority(requestData.priority),
                        buildingId: String(requestData.buildingId || buildingId || ''),
                        createdByTenantId: String(requestData.tenantId || requestData.createdByTenantId || requestData.createdByUserId || requestData.createdById || ''),
                        createdBy: mapRequestCreator(requestData),
                        unit: mapRequestUnit(requestData),
                        attachments: mapRequestAttachments(r),
                        createdAt: requestData.createdAt || new Date().toISOString(),
                        updatedAt: requestData.updatedAt || new Date().toISOString(),
                        assignedEmployeeId: requestData.assignedEmployeeId ?? requestData.assignedTo?.id ?? requestData.assigneeId ?? requestData.assignedStaffId,
                    assignedTo: requestData.assignedTo
                        ? {
                            id: String(requestData.assignedTo.id ?? requestData.assignedTo.userId ?? ''),
                            fullName: requestData.assignedTo.fullName ?? requestData.assignedTo.name,
                            email: requestData.assignedTo.email
                        }
                        : undefined
                };
            });
        } catch (e) { console.warn("Fetch requests failed", e) }
    }

    await delay(DELAY_MS);
    if (buildingId) {
        return MOCK_REQUESTS.filter((r) => r.buildingId === buildingId);
    }
    return MOCK_REQUESTS;
}

export async function getRequestsForBuildings(buildingIds: string[]): Promise<ServiceRequest[]> {
    if (buildingIds.length === 0) return [];
    if (!USE_MOCK) {
        try {
            const responses = await Promise.all(
                buildingIds.map(async (id) => {
                    const res = await fetchJson(`/org/buildings/${id}/requests`).catch(() => []);
                    return { id, data: getArray(res) };
                })
            );
            return responses.flatMap(({ id, data }) =>
                data.map((r: any) => {
                    const requestData = r?.request ?? r?.item ?? r?.data ?? r;
                    return {
                        id: String(requestData.id ?? r.id),
                        title: requestData.title || 'Service Request',
                        description: requestData.description || '',
                        status: mapRequestStatus(requestData.status),
                        priority: mapRequestPriority(requestData.priority),
                        buildingId: String(requestData.buildingId || id),
                        createdByTenantId: String(requestData.tenantId || requestData.createdByTenantId || requestData.createdByUserId || requestData.createdById || ''),
                        createdBy: mapRequestCreator(requestData),
                        unit: mapRequestUnit(requestData),
                        attachments: mapRequestAttachments(r),
                        createdAt: requestData.createdAt || new Date().toISOString(),
                        updatedAt: requestData.updatedAt || new Date().toISOString(),
                        assignedEmployeeId: requestData.assignedEmployeeId ?? requestData.assignedTo?.id ?? requestData.assigneeId ?? requestData.assignedStaffId,
                        assignedTo: requestData.assignedTo
                            ? {
                                id: String(requestData.assignedTo.id ?? requestData.assignedTo.userId ?? ''),
                                fullName: requestData.assignedTo.fullName ?? requestData.assignedTo.name,
                                email: requestData.assignedTo.email
                            }
                            : undefined
                    };
                })
            );
        } catch (e) {
            console.warn("Fetch admin requests failed", e);
        }
    }
    await delay(DELAY_MS);
    return MOCK_REQUESTS.filter((req) => buildingIds.includes(req.buildingId));
}

export async function getRequest(id: string, buildingId?: string): Promise<ServiceRequest | undefined> {
    if (!USE_MOCK) {
        try {
            let commentsPayload: any = [];
            const res = buildingId
                ? await fetchJson(`/org/buildings/${buildingId}/requests/${id}`)
                : await fetchJson(`/MaintenanceRequest/get/${id}`);
            if (buildingId) {
                try {
                    commentsPayload = await fetchJson(`/org/buildings/${buildingId}/requests/${id}/comments`);
                } catch (e) {
                    if (IS_DEV) {
                        console.warn("[API] Request comments fetch failed", e);
                    }
                }
            }
            const raw = res?.data ?? res;
            const data = raw?.request ?? raw?.item ?? raw?.data ?? raw;
            if (!data) return undefined;
            const commentsFromDetail: RequestComment[] = Array.isArray(data.comments)
                ? data.comments.map(mapRequestComment)
                : [];
            const commentsFromEndpoint: RequestComment[] = getArray(commentsPayload).map(mapRequestComment);
            const commentsMap = new Map<string, RequestComment>();
            commentsFromDetail.forEach((comment) => commentsMap.set(comment.id, comment));
            commentsFromEndpoint.forEach((comment) => commentsMap.set(comment.id, comment));
            return {
                id: String(data.id),
                title: data.title || 'Service Request',
                description: data.description || '',
                status: mapRequestStatus(data.status),
                priority: mapRequestPriority(data.priority),
                buildingId: String(data.buildingId || buildingId || ''),
                createdByTenantId: String(data.tenantId || data.createdByTenantId || data.createdByUserId || data.createdById || ''),
                createdBy: mapRequestCreator(data),
                unit: mapRequestUnit(data),
                assignedEmployeeId: data.assignedEmployeeId ?? data.assignedTo?.id ?? data.assigneeId ?? data.assignedStaffId,
                createdAt: data.createdAt || new Date().toISOString(),
                updatedAt: data.updatedAt || new Date().toISOString(),
                completedAt: data.completedAt || null,
                assignedTo: data.assignedTo
                    ? {
                        id: String(data.assignedTo.id),
                        fullName: data.assignedTo.fullName,
                        email: data.assignedTo.email
                    }
                    : undefined,
                comments: Array.from(commentsMap.values()),
                attachments: mapRequestAttachments(raw),
                statusHistory: Array.isArray(data.statusHistory)
                    ? data.statusHistory.map((entry: any) => ({
                        id: String(entry.id),
                        oldStatus: mapRequestStatus(entry.oldStatus),
                        newStatus: mapRequestStatus(entry.newStatus),
                        changedAt: entry.changedAt || new Date().toISOString(),
                        note: entry.note ?? null
                    }))
                    : []
            };
        } catch (e) {
            console.warn("Fetch request failed", e);
        }
    }
    const all = await getRequests(buildingId);
    return all.find((r) => r.id === id);
}

export async function createRequest(request: Omit<ServiceRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceRequest> {
    await delay(DELAY_MS);
    const newRequest: ServiceRequest = {
        ...request,
        id: `r${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    MOCK_REQUESTS.push(newRequest);
    return newRequest;
}

export async function updateRequestStatus(id: string, status: RequestStatus, note?: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${id}/status`, {
                method: 'POST',
                body: JSON.stringify({
                    status: mapRequestStatusToApiStatus(status)
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/status', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(id),
                    newStatus: mapRequestStatusToApi(status),
                    changedById: Number(userId),
                    note: note || ''
                })
            });
        }
        const updated = await getRequest(id, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === id);
    if (!req) throw new Error('Request not found');
    req.status = status;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function cancelRequest(requestId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/cancel`, {
                method: 'POST'
            });
            const updated = await getRequest(requestId, buildingId);
            if (!updated) {
                throw new Error('Request not found');
            }
            return updated;
        }
        return updateRequestStatus(requestId, 'cancelled', undefined, buildingId);
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    req.status = 'cancelled';
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function assignRequest(requestId: string, assignedToId: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/assign`, {
                method: 'POST',
                body: JSON.stringify({
                    staffUserId: assignedToId
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/assign', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(requestId),
                    assignedToId: Number(assignedToId),
                    assignedById: Number(userId)
                })
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    req.assignedEmployeeId = assignedToId;
    req.updatedAt = new Date().toISOString();
    return req;
}

export async function addRequestComment(requestId: string, commentText: string, buildingId?: string): Promise<ServiceRequest> {
    if (!USE_MOCK) {
        if (buildingId) {
            await fetchJson(`/org/buildings/${buildingId}/requests/${requestId}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    message: commentText
                })
            });
        } else {
            const userId = useAuthStore.getState().user?.id;
            if (!userId) {
                throw new Error('User not authenticated');
            }
            await fetchJson('/MaintenanceRequest/comment', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: Number(requestId),
                    userId: Number(userId),
                    commentText
                })
            });
        }
        const updated = await getRequest(requestId, buildingId);
        if (!updated) {
            throw new Error('Request not found');
        }
        return updated;
    }

    await delay(DELAY_MS);
    const req = MOCK_REQUESTS.find((r) => r.id === requestId);
    if (!req) throw new Error('Request not found');
    const newComment = {
        id: String(Date.now()),
        commentText,
        createdAt: new Date().toISOString(),
        user: { userId: useAuthStore.getState().user?.id || '' }
    };
    req.comments = [...(req.comments || []), newComment];
    req.updatedAt = new Date().toISOString();
    return req;
}

// --- Admin APIs (Keep these for Admin specific actions) ---

// --- Generic Create User for all roles ---

export async function createUser(
    role: Role,
    data: AdminDTO & { buildingIds?: string[]; orgRoleKeys?: string[]; assignmentType?: BaseRole }
): Promise<User> {
    const roleKey = String(role ?? '').trim();
    const isBaseRole = roleKey ? isBaseRoleKey(roleKey) : false;
    const baseRole: BaseRole = isBaseRole ? (roleKey as BaseRole) : (data.assignmentType ?? 'manager');
    const normalizedRoleKey = roleKey || baseRole;

    if (baseRole === 'superadmin' || baseRole === 'service_provider') {
        throw new Error(`Creation not supported for role: ${baseRole}`);
    }

    const buildingId = data.buildingId !== undefined && data.buildingId !== null ? String(data.buildingId) : undefined;
    const buildingIds = (data.buildingIds ?? []).map((id) => String(id)).filter(Boolean);
    if (baseRole === 'admin' && buildingId && buildingIds.length === 0) {
        buildingIds.push(buildingId);
    }
    if (!data.email) {
        throw new Error('Email is required.');
    }
    if ((baseRole === 'manager' || baseRole === 'employee') && !buildingId) {
        throw new Error('Building assignment is required.');
    }
    if (baseRole === 'admin' && buildingIds.length === 0) {
        throw new Error('Building assignment is required.');
    }
    if (baseRole === 'tenant' && (!buildingId || !data.unitId)) {
        throw new Error('Unit assignment is required.');
    }
    const identity: Record<string, any> = {
        email: data.email,
        name: data.fullName,
    };

    if (data.password && data.password.trim()) {
        identity.password = data.password;
    } else {
        identity.sendInvite = true;
    }

    const grants: Record<string, any> = {};
    if (baseRole === 'admin' && buildingIds.length > 0) {
        grants.buildingAssignments = buildingIds.map((id) => ({
            buildingId: id,
            type: 'BUILDING_ADMIN'
        }));
    } else if ((baseRole === 'manager' || baseRole === 'employee') && buildingId) {
        grants.buildingAssignments = [
            {
                buildingId,
                type: baseRole === 'manager' ? 'MANAGER' : 'STAFF'
            }
        ];
    }
    if (baseRole === 'tenant' && buildingId && data.unitId) {
        grants.resident = {
            buildingId,
            unitId: data.unitId,
            mode: 'ADD'
        };
    }

    const orgRoleKeys = Array.from(new Set([
        ...(data.orgRoleKeys ?? []),
        ...(isBaseRole ? [] : [normalizedRoleKey]),
    ].map((key) => String(key).trim()).filter(Boolean)));
    if (orgRoleKeys.length > 0) {
        grants.orgRoleKeys = orgRoleKeys;
    }

    const payload: Record<string, any> = { identity };
    if (Object.keys(grants).length > 0) {
        payload.grants = grants;
    }

    if (!USE_MOCK) {
        try {
            if (IS_DEV) {
                console.log(`[API] Provisioning ${normalizedRoleKey} via /org/users/provision`);
                console.log('[API] Provision payload', payload);
            }
            const res = await fetchJson('/org/users/provision', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            const response = res?.data ?? res ?? {};
            const userData = response?.user ?? response?.data?.user ?? response?.identity ?? response ?? {};
            const applied = response?.applied ?? response?.data?.applied ?? {};
            const assignedBuildingIds = new Set<string>();
            const assignments = Array.isArray(applied?.buildingAssignments) ? applied.buildingAssignments : [];
            assignments.forEach((assignment: any) => {
                const assignedId = assignment?.buildingId ?? assignment?.building?.id;
                if (assignedId) assignedBuildingIds.add(String(assignedId));
            });
            const residentBuildingId = applied?.resident?.buildingId ?? applied?.resident?.building?.id;
            if (residentBuildingId) assignedBuildingIds.add(String(residentBuildingId));
            if (baseRole === 'admin' && assignedBuildingIds.size === 0 && buildingIds.length > 0) {
                buildingIds.forEach((id) => assignedBuildingIds.add(id));
            }
            if (buildingId && assignedBuildingIds.size === 0 && baseRole !== 'admin') {
                assignedBuildingIds.add(buildingId);
            }
            const normalized = normalizeUser(userData, baseRole);
            const displayRole = orgRoleKeys[0] ?? normalizedRoleKey ?? baseRole;
            return {
                ...normalized,
                id: String(userData?.id ?? userData?.userId ?? normalized.id ?? Math.random()),
                name: normalized.name || data.fullName,
                email: normalized.email || data.email || '',
                role: displayRole,
                baseRole,
                buildingIds: Array.from(assignedBuildingIds),
                orgId: userData?.orgId ?? normalized.orgId ?? null,
                fullName: userData?.fullName ?? data.fullName,
                phoneNumber: userData?.phoneNumber ?? data.phoneNumber,
                address: userData?.address ?? data.address,
                nationality: userData?.nationality ?? data.nationality
            };
        } catch (e) {
            console.error(`[API] Failed to provision ${normalizedRoleKey}`, e);
            throw e;
        }
    }

    await delay(DELAY_MS);
    const newUser: User = {
        id: 'u' + (MOCK_USERS.length + 1) + Math.random(),
        name: data.fullName,
        email: data.email || `new.${normalizedRoleKey}@test.com`,
        role: orgRoleKeys[0] ?? normalizedRoleKey ?? baseRole,
        baseRole,
        buildingIds: baseRole === 'admin' && buildingIds.length > 0 ? buildingIds : (buildingId ? [buildingId] : []),
        fullName: data.fullName,
        phoneNumber: data.phoneNumber,
        address: data.address,
        nationality: data.nationality
    };
    MOCK_USERS.push(newUser);
    return newUser;
}

export async function createAdmin(data: AdminDTO): Promise<User> {
    return createUser('admin', data);
}

export async function updateAdmin(id: string, data: Partial<AdminDTO>): Promise<User> {
    if (!USE_MOCK) {
        await fetchJson(`/Admin/update/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        return {
            id,
            name: data.fullName || 'Updated',
            email: 'updated@test.com',
            role: 'admin',
            baseRole: 'admin',
            buildingIds: [],
            ...data
        } as User;
    }

    await delay(DELAY_MS);
    const userIndex = MOCK_USERS.findIndex(u => u.id === id);
    if (userIndex === -1) throw new Error('User not found');

    const updatedUser = { ...MOCK_USERS[userIndex], ...data, name: data.fullName || MOCK_USERS[userIndex].name };
    MOCK_USERS[userIndex] = updatedUser;
    return updatedUser;
}

export async function deleteAdmin(id: string): Promise<void> {
    if (!USE_MOCK) {
        await fetchJson(`/Admin/delete/${id}`, { method: 'DELETE' });
        return;
    }
    await delay(DELAY_MS);
    MOCK_USERS = MOCK_USERS.filter(u => u.id !== id);
}

export async function deleteUser(role: Role, id: string, buildingIds: string[] = []): Promise<void> {
    const baseRole = isBaseRoleKey(String(role)) ? (role as BaseRole) : (mapRoleValue(String(role)) ?? 'manager');
    if (baseRole === 'tenant') {
        if (!USE_MOCK) {
            await fetchJson(`/Tenant/delete/${id}`, { method: 'DELETE' });
            return;
        }
        await delay(DELAY_MS);
        MOCK_USERS = MOCK_USERS.filter(u => u.id !== id || u.role !== role);
        return;
    }

    if (baseRole === 'manager' || baseRole === 'employee') {
        if (buildingIds.length === 0) {
            throw new Error('Building assignment is required to remove this user.');
        }
        if (!USE_MOCK) {
            await Promise.all(buildingIds.map((buildingId) => {
                const endpoint = baseRole === 'manager' ? '/BuildingManager/remove' : '/BuildingMaintenanceStaff/remove';
                const payload = baseRole === 'manager'
                    ? { buildingId: Number(buildingId), managerId: Number(id) }
                    : { buildingId: Number(buildingId), staffId: Number(id) };
                return fetchJson(endpoint, {
                    method: 'DELETE',
                    body: JSON.stringify(payload)
                });
            }));
            return;
        }
        await delay(DELAY_MS);
        MOCK_USERS = MOCK_USERS.filter(u => u.id !== id || u.role !== role);
        return;
    }

    throw new Error(`Deletion not supported for role: ${role}`);
}

// Auth
export async function login(email: string, password?: string): Promise<{ user: User; token: string | null; refreshToken: string | null }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password: password ?? '' })
            });

            if (res?.success === false) {
                throw new Error(res?.message || 'Login failed');
            }

            if (res) {
                if (DEBUG_AUTH) {
                    const payloadForLog = res?.data ?? res;
                    logAuth('AUTH', 'login_response', redactLoginPayload(payloadForLog));
                }
                const payload = res?.data ?? res;
                const accessToken = resolveAccessToken(payload, res);
                const refreshToken = resolveRefreshToken(payload, res);
                const userData = payload?.user ?? payload?.data?.user ?? res?.user ?? payload?.data ?? payload ?? {};
                let resolvedUserData = userData;
                let rolePayload = payload;

                if (accessToken) {
                    try {
                        const meRes = await fetch(`${API_BASE_URL}/users/me`, {
                            method: 'GET',
                            headers: {
                                'accept': '*/*',
                                Authorization: `Bearer ${accessToken}`
                            }
                        });
                        if (meRes.ok) {
                            const meJson = await meRes.json();
                            const mePayload = meJson?.data ?? meJson;
                            const meUser = mePayload?.user ?? mePayload?.data?.user ?? mePayload?.data ?? mePayload ?? null;
                            if (meUser && typeof meUser === 'object') {
                                resolvedUserData = { ...userData, ...meUser };
                                rolePayload = { ...payload, ...mePayload, ...meUser };
                            }
                        }
                    } catch (e) {
                        if (IS_DEV) {
                            console.warn('[API] Failed to hydrate user from /users/me', e);
                        }
                    }
                }

                const baseRole = resolveRole(resolvedUserData, rolePayload);
                const preferNonEmptyArray = (...candidates: any[]) => {
                    for (const candidate of candidates) {
                        if (Array.isArray(candidate) && candidate.length > 0) return candidate;
                    }
                    return undefined;
                };
                let roleKeys = preferNonEmptyArray(
                    resolvedUserData?.roleKeys,
                    rolePayload?.roleKeys,
                    userData?.roleKeys,
                    payload?.roleKeys
                );
                const orgRoleKeys = preferNonEmptyArray(
                    resolvedUserData?.orgRoleKeys,
                    rolePayload?.orgRoleKeys,
                    userData?.orgRoleKeys,
                    payload?.orgRoleKeys
                );
                let effectivePermissions = preferNonEmptyArray(
                    resolvedUserData?.effectivePermissions,
                    rolePayload?.effectivePermissions,
                    rolePayload?.permissions,
                    rolePayload?.perms
                );
                const orgId = resolvedUserData?.orgId ?? payload?.orgId ?? null;
                const baseHeaders = accessToken
                    ? ({
                        accept: '*/*',
                        Authorization: `Bearer ${accessToken}`,
                        ...(orgId ? { 'x-org-id': String(orgId) } : {})
                    } as Record<string, string>)
                    : undefined;
                if (accessToken && baseHeaders && (!roleKeys?.length || !effectivePermissions?.length)) {
                    try {
                        if (DEBUG_AUTH) {
                            logAuth('AUTH', 'me_roles_request', { reason: 'missing_permissions' });
                        }
                        const meRolesRes = await fetch(`${API_BASE_URL}/users/me/roles`, {
                            method: 'GET',
                            headers: baseHeaders
                        });
                        if (DEBUG_AUTH) {
                            logAuth('AUTH', 'me_roles_response', { status: meRolesRes.status });
                        }
                        if (meRolesRes.ok) {
                            const meRolesJson = await meRolesRes.json();
                            const meRolesPayload = meRolesJson?.data ?? meRolesJson ?? {};
                            const roles = Array.isArray(meRolesPayload?.roles) ? meRolesPayload.roles : [];
                            if (DEBUG_AUTH) {
                                logAuth('AUTH', 'me_roles_payload', { rolesCount: roles.length });
                            }
                            if (roles.length > 0 && (!roleKeys || roleKeys.length === 0)) {
                                roleKeys = roles.map((entry: any) => String(entry?.key ?? entry?.name ?? '')).filter(Boolean);
                            }
                            const normalizedRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? baseRole ?? '').toLowerCase();
                            const toPermissionList = (value: any) => {
                                if (!Array.isArray(value)) return [];
                                return value
                                    .map((entry) => (typeof entry === 'string' ? entry : entry?.key ?? entry?.permissionKey ?? String(entry)))
                                    .filter((entry) => Boolean(entry));
                            };
                            const matched = roles.find((entry: any) => String(entry?.key ?? entry?.name ?? '').toLowerCase() === normalizedRole);
                            const matchedPermissions = toPermissionList(matched?.permissions ?? matched?.permissionKeys ?? matched?.perms);
                            const allRolePermissions = roles.flatMap((entry: any) => toPermissionList(entry?.permissions ?? entry?.permissionKeys ?? entry?.perms));
                            const resolved = preferNonEmptyArray(matchedPermissions, allRolePermissions);
                            if (resolved?.length) {
                                effectivePermissions = resolved;
                                if (DEBUG_AUTH) {
                                    logAuth('AUTH', 'login_permissions_fallback', { source: 'me_roles', count: resolved.length });
                                }
                            }
                        }
                    } catch (e) {
                        if (IS_DEV) {
                            console.warn('[API] Failed to hydrate permissions from /users/me/roles', e);
                        }
                    }
                }
                const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? resolvedUserData?.role ?? rolePayload?.role ?? baseRole ?? 'user');
                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'login_permissions', {
                        role: displayRole,
                        baseRole,
                        roleKeys: roleKeys ?? [],
                        orgRoleKeys: orgRoleKeys ?? [],
                        effectivePermissions: effectivePermissions ?? []
                    });
                }
                const fullName = resolvedUserData?.fullName ?? ((resolvedUserData?.firstName || resolvedUserData?.lastName)
                    ? [resolvedUserData?.firstName, resolvedUserData?.lastName].filter(Boolean).join(' ')
                    : undefined);
                const displayName = resolvedUserData?.name || fullName || resolvedUserData?.firstName || resolvedUserData?.email?.split('@')[0] || email || 'User';
                if (IS_DEV && accessToken) {
                    console.log('[Auth] Access token:', accessToken);
                }
                return {
                    user: {
                        id: String(resolvedUserData?.id ?? resolvedUserData?.userId ?? resolvedUserData?._id ?? payload?.userId ?? payload?.id ?? 'api-user'),
                        name: displayName,
                        email: resolvedUserData?.email || email,
                        role: displayRole,
                        baseRole,
                        buildingIds: [],
                        orgId: resolvedUserData?.orgId ?? payload?.orgId ?? null,
                        fullName: fullName,
                        phoneNumber: resolvedUserData?.phoneNumber ?? resolvedUserData?.phone,
                        address: resolvedUserData?.address,
                        nationality: resolvedUserData?.nationality,
                        avatarUrl: resolvedUserData?.avatarUrl ?? resolvedUserData?.avatar ?? resolvedUserData?.photoUrl,
                        roleKeys,
                        orgRoleKeys,
                        effectivePermissions
                    },
                    token: accessToken,
                    refreshToken
                };
            }
        } catch (e) {
            console.warn("Login API failed, falling back if allowed.", e);
            throw e;
        }
    }


    await delay(DELAY_MS);
    const user = MOCK_USERS.find(u => u.email === email);
    if (!user) throw new Error('Invalid credentials');
    return { user, token: null, refreshToken: null };
}

export async function register(email: string, password: string, name?: string): Promise<{ user: User; token: string | null; refreshToken: string | null }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name })
        });
        const payload = res?.data ?? res;
        const userData = payload?.user ?? payload?.data?.user ?? res?.user ?? payload?.data ?? payload ?? {};
        const baseRole = resolveRole(userData, payload);
        const roleKeys = Array.isArray(userData?.roleKeys)
            ? userData.roleKeys
            : Array.isArray(payload?.roleKeys)
                ? payload.roleKeys
                : undefined;
        const orgRoleKeys = Array.isArray(userData?.orgRoleKeys)
            ? userData.orgRoleKeys
            : Array.isArray(payload?.orgRoleKeys)
                ? payload.orgRoleKeys
                : undefined;
        const effectivePermissions = Array.isArray(userData?.effectivePermissions)
            ? userData.effectivePermissions
            : Array.isArray(payload?.effectivePermissions)
                ? payload.effectivePermissions
                : Array.isArray(payload?.permissions)
                    ? payload.permissions
                    : Array.isArray(payload?.perms)
                        ? payload.perms
                        : undefined;
        const fullName = userData?.fullName ?? userData?.name ?? name;
        const displayName = userData?.name || fullName || userData?.email?.split('@')[0] || email || 'User';
        const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? userData?.role ?? payload?.role ?? baseRole ?? 'user');
        return {
            user: {
                id: String(userData?.id ?? userData?.userId ?? userData?._id ?? payload?.userId ?? payload?.id ?? 'api-user'),
                name: displayName,
                email: userData?.email || email,
                role: displayRole,
                baseRole,
                buildingIds: [],
                orgId: userData?.orgId ?? payload?.orgId ?? null,
                fullName,
                phoneNumber: userData?.phoneNumber ?? userData?.phone,
                address: userData?.address,
                nationality: userData?.nationality,
                avatarUrl: userData?.avatarUrl ?? userData?.avatar ?? userData?.photoUrl,
                roleKeys,
                orgRoleKeys,
                effectivePermissions
            },
            token: resolveAccessToken(payload, res),
            refreshToken: resolveRefreshToken(payload, res)
        };
    }
    await delay(DELAY_MS);
    const newUser: User = {
        id: `u${Math.random().toString(36).slice(2)}`,
        name: name || email,
        email,
        role: 'admin',
        baseRole: 'admin',
        buildingIds: [],
        fullName: name
    };
    MOCK_USERS.push(newUser);
    return { user: newUser, token: null, refreshToken: null };
}

export async function refreshAuth(refreshToken: string): Promise<{ user: User | null; token: string | null; refreshToken: string | null }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
        const payload = res?.data ?? res;
        const userData = payload?.user ?? payload?.data?.user ?? res?.user ?? null;
        const roleKeys = Array.isArray(userData?.roleKeys)
            ? userData.roleKeys
            : Array.isArray(payload?.roleKeys)
                ? payload.roleKeys
                : undefined;
        const orgRoleKeys = Array.isArray(userData?.orgRoleKeys)
            ? userData.orgRoleKeys
            : Array.isArray(payload?.orgRoleKeys)
                ? payload.orgRoleKeys
                : undefined;
        const effectivePermissions = Array.isArray(userData?.effectivePermissions)
            ? userData.effectivePermissions
            : Array.isArray(payload?.effectivePermissions)
                ? payload.effectivePermissions
                : Array.isArray(payload?.permissions)
                    ? payload.permissions
                    : Array.isArray(payload?.perms)
                        ? payload.perms
                        : undefined;
        const baseRole = userData ? resolveRole(userData, payload) : undefined;
        const displayRole = userData
            ? String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? userData?.role ?? payload?.role ?? baseRole ?? 'user')
            : undefined;
        return {
            user: userData
                ? {
                    id: String(userData?.id ?? userData?.userId ?? userData?._id ?? payload?.userId ?? payload?.id ?? 'api-user'),
                    name: userData?.name || userData?.fullName || userData?.email?.split('@')[0] || 'User',
                    email: userData?.email || '',
                    role: displayRole ?? 'user',
                    baseRole,
                    buildingIds: [],
                    orgId: userData?.orgId ?? payload?.orgId ?? null,
                    fullName: userData?.fullName,
                    phoneNumber: userData?.phoneNumber ?? userData?.phone,
                    address: userData?.address,
                    nationality: userData?.nationality,
                    avatarUrl: userData?.avatarUrl ?? userData?.avatar ?? userData?.photoUrl,
                    roleKeys,
                    orgRoleKeys,
                    effectivePermissions
                }
                : null,
            token: resolveAccessToken(payload, res),
            refreshToken: resolveRefreshToken(payload, res) ?? refreshToken
        };
    }
    await delay(DELAY_MS);
    return { user: null, token: null, refreshToken: null };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function getPlatformOrgs(): Promise<PlatformOrg[]> {
    const res = await fetchJson('/platform/orgs', { method: 'GET' });
    const data = res?.data ?? res ?? [];
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((org: any) => ({
        id: String(org.id ?? org.orgId ?? ''),
        name: org.name ?? org.orgName ?? 'Organization',
        createdAt: org.createdAt
    }));
}

export async function getPlatformOrgAdmins(): Promise<PlatformOrgAdmin[]> {
    const res = await fetchJson('/platform/org-admins', { method: 'GET' });
    const data = res?.data ?? res ?? [];
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return items.map((admin: any) => ({
        id: String(admin.id ?? admin.userId ?? admin.adminId ?? ''),
        email: admin.email ?? admin.user?.email ?? '',
        name: admin.name ?? admin.fullName ?? admin.user?.name ?? admin.user?.fullName,
        orgId: admin.orgId ?? admin.org?.id ?? admin.organizationId ?? null
    }));
}

export async function createPlatformOrg(data: {
    name: string;
    businessName?: string;
    businessType?: OrgBusinessType;
    tradeLicenseNumber?: string;
    vatRegistrationNumber?: string;
    registeredOfficeAddress?: string;
    city?: string;
    officePhoneNumber?: string;
    businessEmailAddress?: string;
    website?: string;
    ownerName?: string;
}): Promise<{ id: string; name: string; createdAt?: string }> {
    const res = await fetchJson('/platform/orgs', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    const body = res?.data ?? res ?? {};
    return {
        id: String(body.id ?? body.orgId ?? ''),
        name: body.name ?? data.name,
        createdAt: body.createdAt
    };
}

export async function getOrgProfile(): Promise<OrgProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/profile');
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.orgId ?? ''),
            name: payload.name ?? payload.orgName ?? '',
            logoUrl: payload.logoUrl ?? payload.logo_url ?? payload.logo,
            businessName: payload.businessName,
            businessType: payload.businessType,
            tradeLicenseNumber: payload.tradeLicenseNumber,
            vatRegistrationNumber: payload.vatRegistrationNumber,
            registeredOfficeAddress: payload.registeredOfficeAddress,
            city: payload.city,
            officePhoneNumber: payload.officePhoneNumber,
            businessEmailAddress: payload.businessEmailAddress,
            website: payload.website,
            ownerName: payload.ownerName
        };
    }
    await delay(DELAY_MS);
    return {
        id: 'org-1',
        name: 'TowerDesk Holdings',
        logoUrl: '',
        businessName: 'TowerDesk Management LLC',
        businessType: 'PROPERTY_MANAGEMENT',
        tradeLicenseNumber: 'TL-12345',
        vatRegistrationNumber: 'VAT-12345',
        registeredOfficeAddress: '123 Main St',
        city: 'Dubai',
        officePhoneNumber: '+971-4-555-0100',
        businessEmailAddress: 'info@towerdesk.com',
        website: 'https://towerdesk.com',
        ownerName: 'Jane Founder'
    };
}

export async function updateOrgProfile(data: {
    name?: string;
    logoUrl?: string;
    businessName?: string;
    businessType?: OrgBusinessType;
    tradeLicenseNumber?: string;
    vatRegistrationNumber?: string;
    registeredOfficeAddress?: string;
    city?: string;
    officePhoneNumber?: string;
    businessEmailAddress?: string;
    website?: string;
    ownerName?: string;
}): Promise<OrgProfile> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/profile', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.orgId ?? ''),
            name: payload.name ?? payload.orgName ?? data.name ?? '',
            logoUrl: payload.logoUrl ?? payload.logo_url ?? data.logoUrl,
            businessName: payload.businessName ?? data.businessName,
            businessType: payload.businessType ?? data.businessType,
            tradeLicenseNumber: payload.tradeLicenseNumber ?? data.tradeLicenseNumber,
            vatRegistrationNumber: payload.vatRegistrationNumber ?? data.vatRegistrationNumber,
            registeredOfficeAddress: payload.registeredOfficeAddress ?? data.registeredOfficeAddress,
            city: payload.city ?? data.city,
            officePhoneNumber: payload.officePhoneNumber ?? data.officePhoneNumber,
            businessEmailAddress: payload.businessEmailAddress ?? data.businessEmailAddress,
            website: payload.website ?? data.website,
            ownerName: payload.ownerName ?? data.ownerName
        };
    }
    await delay(DELAY_MS);
    return {
        id: 'org-1',
        name: data.name ?? 'TowerDesk Holdings',
        logoUrl: data.logoUrl,
        businessName: data.businessName,
        businessType: data.businessType,
        tradeLicenseNumber: data.tradeLicenseNumber,
        vatRegistrationNumber: data.vatRegistrationNumber,
        registeredOfficeAddress: data.registeredOfficeAddress,
        city: data.city,
        officePhoneNumber: data.officePhoneNumber,
        businessEmailAddress: data.businessEmailAddress,
        website: data.website,
        ownerName: data.ownerName
    };
}

export async function createPlatformOrgAdmin(orgId: string, payload: { name: string; email: string; password?: string }) {
    const res = await fetchJson(`/platform/orgs/${orgId}/admins`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const data = res?.data ?? res ?? {};
    return {
        userId: String(data.userId ?? data.id ?? ''),
        email: data.email ?? payload.email,
        tempPassword: data.tempPassword,
        mustChangePassword: data.mustChangePassword ?? true
    };
}

// --- Building Management Functions ---

export async function createBuilding(data: BuildingDTO): Promise<Building> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/buildings', {
            method: 'POST',
            body: JSON.stringify({
                name: data.name,
                city: data.city,
                emirate: data.emirate,
                country: data.country,
                timezone: data.timezone,
                floors: data.floors,
                unitsCount: data.unitsCount
            })
        });
        const b = res?.data || res;
        return {
            id: String(b.id ?? b.buildingId ?? ''),
            name: b.name ?? data.name,
            address: buildBuildingAddress(b) || buildBuildingAddress(data),
            city: b.city ?? data.city,
            emirate: b.emirate ?? data.emirate,
            country: b.country ?? data.country,
            timezone: b.timezone ?? data.timezone,
            floors: b.floors ?? data.floors,
            unitsCount: b.unitsCount ?? b.unintsCount ?? data.unitsCount,
            status: resolveBuildingStatus(b),
            stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
        };
    }
    await delay(DELAY_MS);
    const newBuilding: Building = {
        id: 'b' + (MOCK_BUILDINGS.length + 1),
        name: data.name,
        address: buildBuildingAddress(data),
        city: data.city,
        emirate: data.emirate,
        country: data.country,
        timezone: data.timezone,
        floors: data.floors,
        unitsCount: data.unitsCount,
        status: 'active',
        stats: { totalTenants: 0, activeRequests: 0, occupancyRate: 0 }
    };
    MOCK_BUILDINGS.push(newBuilding);
    return newBuilding;
}

export async function assignAdminToBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: adminId, type: "BUILDING_ADMIN" })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function assignManagerToBuilding(buildingId: string, managerId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: managerId, type: "MANAGER" })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function assignMaintenanceStaffToBuilding(buildingId: string, staffId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ userId: staffId, type: "STAFF" })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function removeAdminFromBuilding(buildingId: string, adminId: string): Promise<any> {
    if (!USE_MOCK) {
        return await fetchJson('/BuildingAdmin/remove', {
            method: 'DELETE',
            body: JSON.stringify({ buildingId: Number(buildingId), adminId: Number(adminId) })
        });
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function getBuildingAdmins(buildingId: string): Promise<User[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/BuildingAdmin/building/${buildingId}`);
        const data = getArray(res);
        return data.map((u: any) => mapUser(u, 'admin'));
    }
    await delay(DELAY_MS);
    return [];
}

export async function getUnitTypes(): Promise<UnitType[]> {
    if (!USE_MOCK) {
        const user = useAuthStore.getState().user;
        const role = user?.baseRole ?? user?.role;
        const permissions = getPermissionSet(user);
        const canView = role === 'superadmin' || role === 'org_admin' || permissions.has('unittypes.read');
        if (!canView) {
            if (IS_DEV) {
                console.warn('[API] Skipping getUnitTypes due to role restrictions', {
                    role,
                    permissions: Array.from(permissions)
                });
            }
            return [];
        }
        if (IS_DEV) {
            console.log('[API] getUnitTypes allowed', { role, permissions: Array.from(permissions) });
        }
        const res = await fetchJson('/org/unit-types');
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.unitTypeId ?? item.typeId ?? ''),
            name: item.name ?? item.label ?? item.title ?? '',
            isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createUnitType(data: { name: string; isActive?: boolean }): Promise<UnitType> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const user = useAuthStore.getState().user;
            const role = user?.baseRole ?? user?.role;
            const permissions = getPermissionSet(user);
            console.log('[API] createUnitType attempt', { role, permissions: Array.from(permissions), payload: data });
        }
        const res = await fetchJson('/org/unit-types', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.unitTypeId ?? ''),
            name: payload.name ?? data.name,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(DELAY_MS);
    return { id: String(Date.now()), name: data.name, isActive: data.isActive };
}

export async function getOwners(search?: string): Promise<Owner[]> {
    if (!USE_MOCK) {
        const user = useAuthStore.getState().user;
        const role = user?.baseRole ?? user?.role;
        const permissions = getPermissionSet(user);
        const canView = role === 'superadmin' || role === 'org_admin' || permissions.has('owners.read');
        if (!canView) {
            if (IS_DEV) {
                console.warn('[API] Skipping getOwners due to role restrictions', {
                    role,
                    permissions: Array.from(permissions)
                });
            }
            return [];
        }
        if (IS_DEV) {
            console.log('[API] getOwners allowed', { role, permissions: Array.from(permissions), search });
        }
        const query = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await fetchJson(`/org/owners${query}`);
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.ownerId ?? ''),
            name: item.name ?? item.fullName ?? item.ownerName ?? '',
            email: item.email,
            phone: item.phone ?? item.phoneNumber,
            address: item.address
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createOwner(data: { name: string; email?: string; phone?: string; address?: string }): Promise<Owner> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const user = useAuthStore.getState().user;
            const role = user?.baseRole ?? user?.role;
            const permissions = getPermissionSet(user);
            console.log('[API] createOwner attempt', { role, permissions: Array.from(permissions), payload: data });
        }
        const res = await fetchJson('/org/owners', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.ownerId ?? ''),
            name: payload.name ?? data.name,
            email: payload.email ?? data.email,
            phone: payload.phone ?? payload.phoneNumber ?? data.phone,
            address: payload.address ?? data.address
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(Date.now()),
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address
    };
}

export async function getBuildingAmenities(buildingId: string): Promise<Amenity[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities`);
        const data = getArray(res);
        return data.map((item: any) => ({
            id: String(item.id ?? item.amenityId ?? ''),
            name: item.name ?? item.label ?? '',
            isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : undefined
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createBuildingAmenity(
    buildingId: string,
    data: { name: string; isDefault?: boolean; isActive?: boolean }
): Promise<Amenity> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.amenityId ?? ''),
            name: payload.name ?? data.name,
            isDefault: typeof payload.isDefault === 'boolean' ? payload.isDefault : data.isDefault,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(DELAY_MS);
    return { id: String(Date.now()), name: data.name, isDefault: data.isDefault };
}

export async function updateBuildingAmenity(
    buildingId: string,
    amenityId: string,
    data: { name?: string; isDefault?: boolean; isActive?: boolean }
): Promise<Amenity> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/amenities/${amenityId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const payload = res?.data ?? res ?? {};
        return {
            id: String(payload.id ?? payload.amenityId ?? amenityId),
            name: payload.name ?? data.name ?? '',
            isDefault: typeof payload.isDefault === 'boolean' ? payload.isDefault : data.isDefault,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive
        };
    }
    await delay(DELAY_MS);
    return { id: amenityId, name: data.name ?? '', isDefault: data.isDefault };
}

export async function getBuildingUnit(buildingId: string, unitId: string): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/units/${unitId}`);
        const unit = res?.data ?? res ?? {};
        return {
            id: String(unit.id ?? unit.unitId ?? unitId),
            label: unit.label ?? unit.unitLabel ?? unit.name ?? '',
            floor: unit.floor ?? unit.floorNumber,
            notes: unit.notes,
            unitTypeId: unit.unitTypeId,
            ownerId: unit.ownerId,
            maintenancePayer: unit.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : undefined,
            unitSizeUnit: (unit.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? undefined,
            bathrooms: unit.bathrooms ?? undefined,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : undefined,
            kitchenType: unit.kitchenType,
            furnishedStatus: unit.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : undefined,
            paymentFrequency: unit.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : undefined,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : undefined,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : undefined,
            electricityMeterNumber: unit.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber,
            includedParkingSlots: unit.includedParkingSlots,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : undefined,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available ?? (unit.status ? String(unit.status).toLowerCase() === 'available' : undefined)
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(unitId),
        label: 'Unit',
        unitSizeUnit: "SQ_FT",
    };
}

export async function getBuildingUnits(buildingId: string, options?: { available?: boolean }): Promise<BuildingUnit[]> {
    if (!USE_MOCK) {
        const query = options?.available ? '?available=true' : '';
        const res = await fetchJson(`/org/buildings/${buildingId}/units${query}`);
        const units = getArray(res);
        return units.map((u: any) => ({
            id: String(u.id ?? u.unitId ?? ''),
            label: u.label ?? u.unitLabel ?? u.name ?? '',
            floor: u.floor ?? u.floorNumber,
            notes: u.notes,
            unitTypeId: u.unitTypeId,
            ownerId: u.ownerId,
            maintenancePayer: u.maintenancePayer,
            unitSize: u.unitSize ? Number(u.unitSize) : undefined,
            unitSizeUnit: (u.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: u.bedrooms ?? undefined,
            bathrooms: u.bathrooms ?? undefined,
            balcony: typeof u.balcony === 'boolean' ? u.balcony : undefined,
            kitchenType: u.kitchenType,
            furnishedStatus: u.furnishedStatus,
            rentAnnual: u.rentAnnual ? Number(u.rentAnnual) : undefined,
            paymentFrequency: u.paymentFrequency,
            securityDepositAmount: u.securityDepositAmount ? Number(u.securityDepositAmount) : undefined,
            serviceChargePerUnit: u.serviceChargePerUnit ? Number(u.serviceChargePerUnit) : undefined,
            vatApplicable: typeof u.vatApplicable === 'boolean' ? u.vatApplicable : undefined,
            electricityMeterNumber: u.electricityMeterNumber,
            waterMeterNumber: u.waterMeterNumber,
            gasMeterNumber: u.gasMeterNumber,
            includedParkingSlots: u.includedParkingSlots != null ? Number(u.includedParkingSlots) : undefined,
            isAvailable: u.isAvailable ?? u.available ?? (u.status ? String(u.status).toLowerCase() === 'available' : undefined)
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createBuildingUnit(buildingId: string, data: {
    label: string;
    floor?: number;
    notes?: string;
    unitTypeId?: string;
    ownerId?: string;
    maintenancePayer?: MaintenancePayer;
    unitSize?: number;
    unitSizeUnit?: UnitSizeUnit;
    bedrooms?: number;
    bathrooms?: number;
    balcony?: boolean;
    kitchenType?: KitchenType;
    furnishedStatus?: FurnishedStatus;
    rentAnnual?: number;
    paymentFrequency?: PaymentFrequency;
    securityDepositAmount?: number;
    serviceChargePerUnit?: number;
    vatApplicable?: boolean;
    electricityMeterNumber?: string;
    waterMeterNumber?: string;
    gasMeterNumber?: string;
    includedParkingSlots?: number;
    amenityIds?: string[];
}): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        if (IS_DEV) {
            const { user, selectedOrgId } = useAuthStore.getState();
            const permissions = getPermissionSet(user);
            console.log('[API] createBuildingUnit attempt', {
                buildingId,
                orgId: selectedOrgId ?? user?.orgId ?? null,
                role: user?.role ?? null,
                permissions: Array.from(permissions),
                assignedBuildings: user?.buildingIds ?? [],
                payload: data
            });
        }
        const res = await fetchJson(`/org/buildings/${buildingId}/units`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const unit = res?.data ?? res;
        return {
            id: String(unit.id ?? unit.unitId ?? ''),
            label: unit.label ?? unit.unitLabel ?? data.label,
            floor: unit.floor ?? unit.floorNumber ?? data.floor,
            notes: unit.notes ?? data.notes,
            unitTypeId: unit.unitTypeId ?? data.unitTypeId,
            ownerId: unit.ownerId ?? data.ownerId,
            maintenancePayer: unit.maintenancePayer ?? data.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : data.unitSize,
            unitSizeUnit: (unit.unitSizeUnit ?? data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? data.bedrooms,
            bathrooms: unit.bathrooms ?? data.bathrooms,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : data.balcony,
            kitchenType: unit.kitchenType ?? data.kitchenType,
            furnishedStatus: unit.furnishedStatus ?? data.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : data.rentAnnual,
            paymentFrequency: unit.paymentFrequency ?? data.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : data.securityDepositAmount,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : data.serviceChargePerUnit,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : data.vatApplicable,
            electricityMeterNumber: unit.electricityMeterNumber ?? data.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber ?? data.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber ?? data.gasMeterNumber,
            includedParkingSlots: unit.includedParkingSlots ?? data.includedParkingSlots,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : data.amenityIds,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(Date.now()),
        label: data.label,
        floor: data.floor,
        notes: data.notes,
        unitTypeId: data.unitTypeId,
        ownerId: data.ownerId,
        maintenancePayer: data.maintenancePayer,
        unitSize: data.unitSize,
        unitSizeUnit: (data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        balcony: data.balcony,
        kitchenType: data.kitchenType,
        furnishedStatus: data.furnishedStatus,
        rentAnnual: data.rentAnnual,
        paymentFrequency: data.paymentFrequency,
        securityDepositAmount: data.securityDepositAmount,
        serviceChargePerUnit: data.serviceChargePerUnit,
        vatApplicable: data.vatApplicable,
        electricityMeterNumber: data.electricityMeterNumber,
        waterMeterNumber: data.waterMeterNumber,
        gasMeterNumber: data.gasMeterNumber,
        amenityIds: data.amenityIds,
        isAvailable: true
    };
}

export async function updateBuildingUnit(buildingId: string, unitId: string, data: {
    label?: string;
    floor?: number;
    notes?: string;
    unitTypeId?: string;
    ownerId?: string;
    maintenancePayer?: MaintenancePayer;
    unitSize?: number;
    unitSizeUnit?: UnitSizeUnit;
    bedrooms?: number;
    bathrooms?: number;
    balcony?: boolean;
    kitchenType?: KitchenType;
    furnishedStatus?: FurnishedStatus;
    rentAnnual?: number;
    paymentFrequency?: PaymentFrequency;
    securityDepositAmount?: number;
    serviceChargePerUnit?: number;
    vatApplicable?: boolean;
    electricityMeterNumber?: string;
    waterMeterNumber?: string;
    gasMeterNumber?: string;
    includedParkingSlots?: number;
    amenityIds?: string[];
}): Promise<BuildingUnit> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/units/${unitId}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        const unit = res?.data ?? res;
        return {
            id: String(unit.id ?? unit.unitId ?? unitId),
            label: unit.label ?? unit.unitLabel ?? data.label ?? '',
            floor: unit.floor ?? unit.floorNumber ?? data.floor,
            notes: unit.notes ?? data.notes,
            unitTypeId: unit.unitTypeId ?? data.unitTypeId,
            ownerId: unit.ownerId ?? data.ownerId,
            maintenancePayer: unit.maintenancePayer ?? data.maintenancePayer,
            unitSize: unit.unitSize ? Number(unit.unitSize) : data.unitSize,
            unitSizeUnit: (unit.unitSizeUnit ?? data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
            bedrooms: unit.bedrooms ?? data.bedrooms,
            bathrooms: unit.bathrooms ?? data.bathrooms,
            balcony: typeof unit.balcony === 'boolean' ? unit.balcony : data.balcony,
            kitchenType: unit.kitchenType ?? data.kitchenType,
            furnishedStatus: unit.furnishedStatus ?? data.furnishedStatus,
            rentAnnual: unit.rentAnnual ? Number(unit.rentAnnual) : data.rentAnnual,
            paymentFrequency: unit.paymentFrequency ?? data.paymentFrequency,
            securityDepositAmount: unit.securityDepositAmount ? Number(unit.securityDepositAmount) : data.securityDepositAmount,
            serviceChargePerUnit: unit.serviceChargePerUnit ? Number(unit.serviceChargePerUnit) : data.serviceChargePerUnit,
            vatApplicable: typeof unit.vatApplicable === 'boolean' ? unit.vatApplicable : data.vatApplicable,
            electricityMeterNumber: unit.electricityMeterNumber ?? data.electricityMeterNumber,
            waterMeterNumber: unit.waterMeterNumber ?? data.waterMeterNumber,
            gasMeterNumber: unit.gasMeterNumber ?? data.gasMeterNumber,
            includedParkingSlots: unit.includedParkingSlots ?? data.includedParkingSlots,
            amenityIds: Array.isArray(unit.amenityIds) ? unit.amenityIds.map((id: any) => String(id)) : data.amenityIds,
            amenities: Array.isArray(unit.amenities)
                ? unit.amenities.map((item: any) => ({
                    id: String(item.id ?? item.amenityId ?? ''),
                    name: item.name ?? item.label ?? '',
                    isDefault: typeof item.isDefault === 'boolean' ? item.isDefault : undefined
                }))
                : undefined,
            isAvailable: unit.isAvailable ?? unit.available
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(unitId),
        label: data.label ?? '',
        floor: data.floor,
        notes: data.notes,
        unitTypeId: data.unitTypeId,
        ownerId: data.ownerId,
        maintenancePayer: data.maintenancePayer,
        unitSize: data.unitSize,
        unitSizeUnit: (data.unitSizeUnit ?? "SQ_FT") as UnitSizeUnit,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        balcony: data.balcony,
        kitchenType: data.kitchenType,
        furnishedStatus: data.furnishedStatus,
        rentAnnual: data.rentAnnual,
        paymentFrequency: data.paymentFrequency,
        securityDepositAmount: data.securityDepositAmount,
        serviceChargePerUnit: data.serviceChargePerUnit,
        vatApplicable: data.vatApplicable,
        electricityMeterNumber: data.electricityMeterNumber,
        waterMeterNumber: data.waterMeterNumber,
        gasMeterNumber: data.gasMeterNumber,
        amenityIds: data.amenityIds,
        isAvailable: true
    };
}

export async function importBuildingUnitsCsv(
    buildingId: string,
    file: File,
    options?: { dryRun?: boolean; mode?: UnitsImportMode }
): Promise<UnitsImportResponse> {
    if (USE_MOCK) {
        await delay(DELAY_MS);
        return { dryRun: options?.dryRun ?? false, mode: options?.mode ?? "create", summary: { totalRows: 0, validRows: 0, created: 0, updated: 0 }, errors: [] };
    }

    const dryRun = options?.dryRun ?? false;
    const mode = options?.mode ?? "create";
    const query = new URLSearchParams();
    query.set("mode", mode);
    if (dryRun) {
        query.set("dryRun", "true");
    }

    const endpoint = `/org/buildings/${buildingId}/units/import?${query.toString()}`;
    if (IS_DEV) {
        console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
    }

    const { token, user, selectedOrgId, refreshToken } = useAuthStore.getState();
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
    const isOrgEndpoint = normalizedEndpoint.startsWith("/org/") || normalizedEndpoint.startsWith("/notifications");
    const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
    const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);

    const formData = new FormData();
    formData.append("file", file);
    if (IS_DEV) {
        console.log("[API] Units import payload", {
            buildingId,
            mode,
            dryRun,
            orgId: activeOrgId ?? null,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || null,
        });
    }

    const runRequest = async (authToken?: string | null) => {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                accept: "*/*",
                ...(authToken && shouldAttachAuth ? { Authorization: `Bearer ${authToken}` } : {}),
                ...(shouldAttachOrg ? { "x-org-id": String(activeOrgId) } : {}),
            },
            body: formData,
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        return res;
    };

    let res = await runRequest(token ?? null);

    if (res.status === 401 && refreshToken && !isPublicEndpoint(endpoint)) {
        const refreshed = await refreshSession();
        if (refreshed) {
            res = await runRequest(refreshed);
        } else if (shouldAttachAuth) {
            useAuthStore.getState().logout();
        }
    }

    if (!res.ok) {
        let errorBody = "";
        try {
            errorBody = await res.text();
        } catch {
            errorBody = "";
        }
        if (IS_DEV) {
            console.error(`API Error: ${res.status} ${res.statusText}`);
            if (errorBody) {
                console.error(`[API] Error Body:`, errorBody);
            }
            console.error("[API] Units import debug", {
                endpoint,
                buildingId,
                mode,
                dryRun,
                orgId: activeOrgId ?? null,
                fileName: file.name,
                fileSize: file.size,
            });
        }
        const contentType = res.headers.get("content-type");
        let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
        if (errorBody) {
            try {
                const parsed = JSON.parse(errorBody);
                const parsedMessage =
                    parsed?.message ??
                    parsed?.error?.message ??
                    parsed?.error?.detail ??
                    parsed?.error?.error ??
                    parsed?.data?.message ??
                    parsed?.data?.error?.message;
                if (parsedMessage) {
                    errorMessage = parsedMessage;
                }
            } catch {
                // Keep friendly message.
            }
        }
        throw new Error(errorMessage);
    }

    const payload = await res.json();
    if (IS_DEV) {
        console.log(`[API] Data received for ${endpoint}`);
    }
    const data = payload?.data ?? payload;
    return {
        dryRun: data?.dryRun ?? dryRun,
        mode: data?.mode ?? mode,
        summary: (data?.summary ?? {}) as UnitsImportResponse["summary"],
        errors: Array.isArray(data?.errors) ? (data.errors as UnitsImportResponse["errors"]) : [],
        unitIds: Array.isArray(data?.unitIds) ? (data.unitIds as string[]) : undefined,
    };
}

export async function importParkingSlotsCsv(
    buildingId: string,
    file: File,
    options?: { dryRun?: boolean; mode?: ParkingSlotsImportMode }
): Promise<ParkingSlotsImportResponse> {
    if (USE_MOCK) {
        await delay(DELAY_MS);
        return { dryRun: options?.dryRun ?? false, mode: options?.mode ?? "create", summary: { totalRows: 0, validRows: 0, created: 0, updated: 0 }, errors: [] };
    }

    const dryRun = options?.dryRun ?? false;
    const mode = options?.mode ?? "create";
    const query = new URLSearchParams();
    query.set("mode", mode);
    if (dryRun) {
        query.set("dryRun", "true");
    }

    const endpoint = `/org/buildings/${buildingId}/parking-slots/import?${query.toString()}`;
    if (IS_DEV) {
        console.log(`[API] Fetching: ${API_BASE_URL}${endpoint}`);
    }

    const { token, user, selectedOrgId, refreshToken } = useAuthStore.getState();
    const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const shouldAttachAuth = Boolean(token) && !isPublicEndpoint(endpoint);
    const isOrgEndpoint = normalizedEndpoint.startsWith("/org/") || normalizedEndpoint.startsWith("/notifications");
    const activeOrgId = selectedOrgId ?? user?.orgId ?? null;
    const shouldAttachOrg = isOrgEndpoint && Boolean(activeOrgId);

    const formData = new FormData();
    formData.append("file", file);
    if (IS_DEV) {
        console.log("[API] Parking slots import payload", {
            buildingId,
            mode,
            dryRun,
            orgId: activeOrgId ?? null,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || null,
        });
    }

    const runRequest = async (authToken?: string | null) => {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: "POST",
            headers: {
                accept: "*/*",
                ...(authToken && shouldAttachAuth ? { Authorization: `Bearer ${authToken}` } : {}),
                ...(shouldAttachOrg ? { "x-org-id": String(activeOrgId) } : {}),
            },
            body: formData,
        });
        if (IS_DEV) {
            console.log(`[API] Status: ${res.status}`);
        }
        return res;
    };

    let res = await runRequest(token ?? null);

    if (res.status === 401 && refreshToken && !isPublicEndpoint(endpoint)) {
        const refreshed = await refreshSession();
        if (refreshed) {
            res = await runRequest(refreshed);
        } else if (shouldAttachAuth) {
            useAuthStore.getState().logout();
        }
    }

    if (!res.ok) {
        let errorBody = "";
        try {
            errorBody = await res.text();
        } catch {
            errorBody = "";
        }
        if (IS_DEV) {
            console.error(`API Error: ${res.status} ${res.statusText}`);
            if (errorBody) {
                console.error(`[API] Error Body:`, errorBody);
            }
            console.error("[API] Parking slots import debug", {
                endpoint,
                buildingId,
                mode,
                dryRun,
                orgId: activeOrgId ?? null,
                fileName: file.name,
                fileSize: file.size,
            });
        }
        const contentType = res.headers.get("content-type");
        let errorMessage = buildFriendlyErrorMessage(res.status, errorBody, contentType);
        if (errorBody) {
            try {
                const parsed = JSON.parse(errorBody);
                const parsedMessage =
                    parsed?.message ??
                    parsed?.error?.message ??
                    parsed?.error?.detail ??
                    parsed?.error?.error ??
                    parsed?.data?.message ??
                    parsed?.data?.error?.message;
                if (parsedMessage) {
                    errorMessage = parsedMessage;
                }
            } catch {
                // Keep friendly message.
            }
        }
        throw new Error(errorMessage);
    }

    const payload = await res.json();
    if (IS_DEV) {
        console.log(`[API] Data received for ${endpoint}`);
    }
    const data = payload?.data ?? payload;
    return {
        dryRun: data?.dryRun ?? dryRun,
        mode: data?.mode ?? mode,
        summary: (data?.summary ?? {}) as ParkingSlotsImportResponse["summary"],
        errors: Array.isArray(data?.errors) ? (data.errors as ParkingSlotsImportResponse["errors"]) : [],
        slotIds: Array.isArray(data?.slotIds) ? (data.slotIds as string[]) : undefined,
    };
}

export async function getBuildingAssignments(buildingId: string): Promise<BuildingAssignment[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/assignments`);
        const assignments = getArray(res);
        return assignments.map((assignment: any) => ({
            id: String(assignment.id ?? assignment.assignmentId ?? assignment.userId ?? ''),
            userId: assignment.userId ?? assignment.user?.id,
            type: assignment.type ?? assignment.assignmentType ?? assignment.role ?? 'STAFF',
            user: assignment.user
                ? {
                    id: String(assignment.user.id ?? assignment.user.userId ?? ''),
                    name: assignment.user.fullName ?? assignment.user.name,
                    email: assignment.user.email
                }
                : undefined
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createBuildingAssignment(buildingId: string, data: { userId: string; type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" }): Promise<BuildingAssignment> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/assignments`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const assignment = res?.data ?? res;
        return {
            id: String(assignment.id ?? assignment.assignmentId ?? data.userId),
            userId: assignment.userId ?? data.userId,
            type: assignment.type ?? assignment.assignmentType ?? data.type,
            user: assignment.user
                ? {
                    id: String(assignment.user.id ?? assignment.user.userId ?? ''),
                    name: assignment.user.fullName ?? assignment.user.name,
                    email: assignment.user.email
                }
                : undefined
        };
    }
    await delay(DELAY_MS);
    return { id: String(Date.now()), userId: data.userId, type: data.type };
}

export async function getBuildingResidents(buildingId: string): Promise<BuildingResident[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/residents`);
        const residents = getArray(res);
        return residents.map((resident: any) => ({
            userId: String(resident.userId ?? resident.user?.id ?? resident.id ?? ''),
            name: resident.name ?? resident.user?.fullName ?? resident.user?.name ?? '',
            email: resident.email ?? resident.user?.email ?? '',
            phoneNumber: resident.phone ?? resident.user?.phone ?? resident.user?.phoneNumber,
            avatarUrl: resident.avatarUrl ?? resident.user?.avatarUrl ?? resident.user?.avatar,
            isActive: typeof resident.isActive === 'boolean' ? resident.isActive : undefined,
            unit: resident.unit
                ? {
                    id: String(resident.unit.id ?? resident.unit.unitId ?? ''),
                    label: resident.unit.label ?? resident.unit.unitLabel ?? ''
                }
                : undefined,
            status: resident.status,
            startAt: resident.startAt,
            endAt: resident.endAt
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createBuildingResident(
    buildingId: string,
    data: { name: string; email: string; password?: string; unitId: string }
): Promise<BuildingResident & { tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        // NOTE: Previously we onboarded residents via `/org/users/provision` which (depending on backend behavior)
        // can provision identities and create/modify occupancies. Per request: avoid POSTing occupancies from
        // the frontend and use POST `/residents` to onboard instead.
        //
        // const identity: Record<string, any> = {
        //     email: data.email,
        //     name: data.name,
        // };
        // if (data.password && data.password.trim()) {
        //     identity.password = data.password;
        // } else {
        //     identity.sendInvite = true;
        // }
        // const res = await fetchJson('/org/users/provision', {
        //     method: 'POST',
        //     body: JSON.stringify({
        //         identity,
        //         grants: {
        //             resident: {
        //                 buildingId,
        //                 unitId: data.unitId,
        //                 mode: 'ADD'
        //             }
        //         }
        //     })
        // });

        const body: Record<string, any> = {
            name: data.name,
            email: data.email,
            unitId: data.unitId,
        };
        if (data.password && data.password.trim()) {
            body.password = data.password;
        } else {
            body.sendInvite = true;
        }

        const res = await fetchJson(`/org/buildings/${buildingId}/residents`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        const payload = res?.data ?? res ?? {};
        const resident = payload?.resident ?? payload?.data?.resident ?? payload;
        const userData = resident?.user ?? payload?.user ?? payload?.data?.user ?? payload?.identity ?? {};
        const unit = resident?.unit ?? payload?.unit ?? {};

        return {
            userId: String(
                resident?.userId ??
                userData?.id ??
                userData?.userId ??
                resident?.id ??
                ''
            ),
            name: userData?.fullName ?? userData?.name ?? resident?.name ?? data.name,
            email: userData?.email ?? resident?.email ?? data.email,
            phoneNumber: userData?.phoneNumber ?? userData?.phone ?? resident?.phone ?? resident?.phoneNumber,
            avatarUrl: userData?.avatarUrl ?? userData?.avatar ?? resident?.avatarUrl,
            isActive: typeof userData?.isActive === 'boolean'
                ? userData.isActive
                : (typeof resident?.isActive === 'boolean' ? resident.isActive : undefined),
            unit: {
                id: String(unit?.id ?? unit?.unitId ?? resident?.unitId ?? data.unitId),
                label: unit?.label ?? unit?.unitLabel ?? resident?.unitLabel ?? ""
            },
            status: resident?.status,
            startAt: resident?.startAt,
            endAt: resident?.endAt,
            tempPassword: payload?.tempPassword ?? resident?.tempPassword,
            mustChangePassword: payload?.mustChangePassword ?? resident?.mustChangePassword
        };
    }
    await delay(DELAY_MS);
    return {
        userId: String(Date.now()),
        name: data.name,
        email: data.email,
        unit: { id: data.unitId, label: data.unitId }
    };
}

export async function getUserById(userId: string): Promise<User> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}`);
        const payload = res?.data ?? res ?? {};
        const baseRole = resolveRole(payload, payload);
        const orgRoleKeys = payload.orgRoleKeys ?? payload.roleKeys;
        const roleKeys = payload.roleKeys;
        const displayRole = String((orgRoleKeys?.[0] ?? roleKeys?.[0] ?? payload.role ?? payload.roleName ?? baseRole) ?? baseRole);
        return {
            id: String(payload.id ?? payload.userId ?? userId),
            name: payload.name ?? payload.fullName ?? payload.email?.split('@')[0] ?? 'User',
            email: payload.email ?? '',
            role: displayRole,
            baseRole,
            buildingIds: Array.isArray(payload.buildingIds) ? payload.buildingIds.map((id: any) => String(id)) : [],
            orgId: payload.orgId ?? null,
            orgRoleKeys,
            roleKeys,
            effectivePermissions: payload.effectivePermissions ?? payload.permissions ?? payload.perms,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? payload.photoUrl,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : undefined,
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber ?? payload.phone,
            address: payload.address,
            nationality: payload.nationality
        };
    }
    await delay(DELAY_MS);
    const user = MOCK_USERS.find((entry) => entry.id === userId) ?? MOCK_USERS[0];
    return user;
}

export async function updateUserProfile(
    userId: string,
    data: { name?: string; email?: string; phoneNumber?: string; avatarUrl?: string; isActive?: boolean }
): Promise<User> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                name: data.name,
                email: data.email,
                phoneNumber: data.phoneNumber,
                phone: data.phoneNumber,
                avatarUrl: data.avatarUrl,
                isActive: data.isActive
            })
        });
        const payload = res?.data ?? res ?? {};
        const baseRole = resolveRole(payload, payload);
        const orgRoleKeys = payload.orgRoleKeys ?? payload.roleKeys;
        const roleKeys = payload.roleKeys;
        const displayRole = String((orgRoleKeys?.[0] ?? roleKeys?.[0] ?? payload.role ?? payload.roleName ?? baseRole) ?? baseRole);
        return {
            id: String(payload.id ?? payload.userId ?? userId),
            name: payload.name ?? payload.fullName ?? data.name ?? payload.email?.split('@')[0] ?? 'User',
            email: payload.email ?? data.email ?? '',
            role: displayRole,
            baseRole,
            buildingIds: Array.isArray(payload.buildingIds) ? payload.buildingIds.map((id: any) => String(id)) : [],
            orgId: payload.orgId ?? null,
            orgRoleKeys,
            roleKeys,
            effectivePermissions: payload.effectivePermissions ?? payload.permissions ?? payload.perms,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? payload.photoUrl ?? data.avatarUrl,
            isActive: typeof payload.isActive === 'boolean' ? payload.isActive : data.isActive,
            fullName: payload.fullName,
            phoneNumber: payload.phoneNumber ?? payload.phone ?? data.phoneNumber,
            address: payload.address,
            nationality: payload.nationality
        };
    }
    await delay(DELAY_MS);
    const existing = MOCK_USERS.find((entry) => entry.id === userId);
    const next: User = {
        ...(existing ?? {
            id: userId,
            name: data.name ?? 'User',
            email: data.email ?? '',
            role: 'tenant',
            baseRole: 'tenant',
            buildingIds: []
        }),
        name: data.name ?? existing?.name ?? 'User',
        email: data.email ?? existing?.email ?? '',
        phoneNumber: data.phoneNumber ?? existing?.phoneNumber,
        avatarUrl: data.avatarUrl ?? existing?.avatarUrl,
        isActive: typeof data.isActive === 'boolean' ? data.isActive : existing?.isActive
    };
    return next;
}

export async function resetUserPassword(userId: string): Promise<{ tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(`/users/${userId}/reset-password`, {
                method: 'POST',
                body: JSON.stringify({})
            }, { silentStatusCodes: [404] });
            const payload = res?.data ?? res ?? {};
            return {
                tempPassword: payload.tempPassword ?? payload.password ?? undefined,
                mustChangePassword: typeof payload.mustChangePassword === 'boolean' ? payload.mustChangePassword : undefined
            };
        } catch (error) {
            if (error instanceof Error && /404/.test(error.message) || (error as any).silent) {
                throw new Error('Password reset is not supported by this API endpoint.');
            }
            throw error;
        }
    }
    await delay(DELAY_MS);
    return { tempPassword: Math.random().toString(36).slice(2, 10), mustChangePassword: true };
}

export async function getBuildingOccupancies(buildingId: string): Promise<BuildingOccupancy[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/occupancies`);
        const occupancies = getArray(res);
        return occupancies.map((entry: any) => {
            const unit = entry.unit ?? entry.unitInfo ?? {};
            const resident = entry.resident ?? entry.user ?? entry.residentUser ?? {};
            return {
                id: String(entry.id ?? entry.occupancyId ?? ''),
                unitId: String(entry.unitId ?? unit.id ?? unit.unitId ?? ''),
                unitLabel: unit.label ?? unit.unitLabel ?? entry.unitLabel ?? '',
                residentUserId: entry.residentUserId ?? resident.id ?? resident.userId ?? entry.userId,
                residentName: resident.name ?? resident.fullName ?? entry.residentName ?? '',
                residentEmail: resident.email ?? entry.residentEmail ?? '',
                status: entry.status,
                startAt: entry.startAt,
                endAt: entry.endAt
            };
        });
    }
    await delay(DELAY_MS);
    return [];
}
export async function getBuildingOccupanciesDto(
    buildingId: string,
    status: "ACTIVE" | "ENDED" | "ALL" = "ACTIVE"
): Promise<OccupancyResponseDto[]> {
  if (!USE_MOCK) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetchJson(`/org/buildings/${buildingId}/occupancies${query}`);

    // Your endpoint returns a raw array
    const rows = Array.isArray(res) ? res : getArray(res);

    return rows.map(mapOccupancyResponseDto);
  }

  await delay(DELAY_MS);
  return [];
}

export async function moveResidentOccupancy(data: {
    buildingId: string;
    residentUserId: string;
    residentEmail: string;
    residentName: string;
    unitId?: string;
    mode: 'MOVE' | 'MOVE_OUT';
}): Promise<BuildingResident & { tempPassword?: string; mustChangePassword?: boolean }> {
    if (!USE_MOCK) {
        if (data.mode === 'MOVE' && !data.unitId) {
            throw new Error('Unit is required to move resident');
        }
        const res = await fetchJson('/org/users/provision', {
            method: 'POST',
            body: JSON.stringify({
                identity: {
                    email: data.residentEmail,
                    name: data.residentName
                },
                grants: {
                    resident: {
                        buildingId: data.buildingId,
                        unitId: data.unitId,
                        mode: data.mode
                    }
                },
                mode: {
                    ifEmailExists: 'LINK',
                    requireSameOrg: true
                }
            })
        });
        const payload = res?.data ?? res ?? {};
        const userData = payload?.user ?? payload?.data?.user ?? payload?.identity ?? {};
        const applied = payload?.applied ?? payload?.data?.applied ?? {};
        const resident = applied?.resident ?? payload?.resident ?? payload?.data?.resident ?? {};
        const unit = resident?.unit ?? {};
        return {
            userId: String(userData?.id ?? userData?.userId ?? resident?.userId ?? data.residentUserId ?? ''),
            name: userData?.fullName ?? userData?.name ?? data.residentName,
            email: userData?.email ?? data.residentEmail,
            unit: {
                id: String(unit.id ?? unit.unitId ?? resident?.unitId ?? data.unitId),
                label: unit.label ?? unit.unitLabel ?? ""
            },
            status: resident?.status,
            startAt: resident?.startAt,
            endAt: resident?.endAt,
            tempPassword: payload?.tempPassword ?? resident?.tempPassword,
            mustChangePassword: payload?.mustChangePassword ?? resident?.mustChangePassword
        };
    }
    await delay(DELAY_MS);
    return {
        userId: data.residentUserId,
        name: data.residentName,
        email: data.residentEmail,
        unit: data.unitId ? { id: data.unitId, label: data.unitId } : undefined
    };
}

export async function updateMyProfile(data: { name?: string; avatarUrl?: string; phone?: string }): Promise<User> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
        throw new Error('User not authenticated');
    }
    if (!USE_MOCK) {
        const res = await fetchJson('/users/me/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const nextUser: User = {
            ...currentUser,
            name: payload.name ?? payload.fullName ?? data.name ?? currentUser.name,
            fullName: payload.fullName ?? payload.name ?? currentUser.fullName,
            avatarUrl: payload.avatarUrl ?? payload.avatar ?? data.avatarUrl ?? currentUser.avatarUrl,
            phoneNumber: payload.phone ?? payload.phoneNumber ?? data.phone ?? currentUser.phoneNumber,
        };
        useAuthStore.setState({ user: nextUser });
        return nextUser;
    }
    await delay(DELAY_MS);
    const nextUser: User = {
        ...currentUser,
        name: data.name ?? currentUser.name,
        fullName: data.name ?? currentUser.fullName,
        avatarUrl: data.avatarUrl ?? currentUser.avatarUrl,
        phoneNumber: data.phone ?? currentUser.phoneNumber,
    };
    useAuthStore.setState({ user: nextUser });
    return nextUser;
}

export async function getNotifications(params?: { unreadOnly?: boolean; cursor?: string; limit?: number }): Promise<{ items: NotificationItem[]; nextCursor?: string | null }> {
    if (!USE_MOCK) {
        const { token, user, selectedOrgId } = useAuthStore.getState();
        const role = user?.baseRole ?? user?.role;
        const orgId = selectedOrgId ?? user?.orgId ?? null;
        if (!token || role === 'superadmin' || !orgId) {
            if (IS_DEV) {
                console.warn('[API] Skipping getNotifications due to missing org context');
            }
            return { items: [], nextCursor: null };
        }
        const query = new URLSearchParams();
        if (params?.unreadOnly) {
            query.set('unreadOnly', 'true');
        }
        if (params?.cursor) {
            query.set('cursor', params.cursor);
        }
        if (params?.limit) {
            query.set('limit', String(params.limit));
        }
        const suffix = query.toString();
        const res = await fetchJson(`/notifications${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapNotification);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(DELAY_MS);
    return { items: [], nextCursor: null };
}

export async function markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/notifications/${notificationId}/read`, { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/notifications/read-all', { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

// =====================
// Broadcasts
// =====================

export async function createBroadcast(data: CreateBroadcastInput): Promise<Broadcast> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/broadcasts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapBroadcast(item);
    }
    await delay(DELAY_MS);
    return {
        id: `broadcast-${Date.now()}`,
        title: data.title,
        body: data.body,
        buildingIds: data.buildingIds ?? [],
        recipientCount: 0,
        sender: { id: 'mock', name: 'Mock User', email: 'mock@example.com' },
        createdAt: new Date().toISOString(),
    };
}

export async function getBroadcasts(params?: { limit?: number; cursor?: string; buildingId?: string }): Promise<BroadcastListResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.cursor) query.set('cursor', params.cursor);
        if (params?.buildingId) query.set('buildingId', params.buildingId);
        const suffix = query.toString();
        const res = await fetchJson(`/org/broadcasts${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapBroadcast);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(DELAY_MS);
    return { items: [], nextCursor: null };
}

export async function getBroadcastById(id: string): Promise<Broadcast> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/broadcasts/${id}`);
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapBroadcast(item);
    }
    await delay(DELAY_MS);
    return {
        id,
        title: 'Mock Broadcast',
        body: 'This is a mock broadcast.',
        buildingIds: [],
        recipientCount: 0,
        sender: { id: 'mock', name: 'Mock User', email: 'mock@example.com' },
        createdAt: new Date().toISOString(),
    };
}

// =====================
// Conversations
// =====================

export async function createConversation(data: CreateConversationInput): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson('/org/conversations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversation(item);
    }
    await delay(DELAY_MS);
    return {
        id: `conversation-${Date.now()}`,
        subject: data.subject ?? null,
        buildingId: data.buildingId ?? null,
        participants: data.participantUserIds.map((id) => ({ id })),
        unreadCount: 0,
        lastMessage: {
            id: `msg-${Date.now()}`,
            content: data.message,
            sender: { id: 'mock', name: 'Mock User', avatarUrl: null },
            createdAt: new Date().toISOString(),
        },
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export async function getConversations(params?: { limit?: number; cursor?: string }): Promise<ConversationListResponse> {
    if (!USE_MOCK) {
        const query = new URLSearchParams();
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.cursor) query.set('cursor', params.cursor);
        const suffix = query.toString();
        const res = await fetchJson(`/org/conversations${suffix ? `?${suffix}` : ''}`);
        const payload = res?.data ?? res ?? {};
        const itemsRaw = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload ?? [];
        const items = getArray(itemsRaw).map(mapConversation);
        const nextCursor = payload?.nextCursor ?? payload?.data?.nextCursor ?? null;
        return { items, nextCursor };
    }
    await delay(DELAY_MS);
    return { items: [], nextCursor: null };
}

export async function getConversationById(id: string): Promise<Conversation> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${id}`);
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversation(item);
    }
    await delay(DELAY_MS);
    return {
        id,
        subject: 'Mock Conversation',
        buildingId: null,
        participants: [],
        unreadCount: 0,
        lastMessage: null,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
}

export async function sendConversationMessage(conversationId: string, data: { content: string }): Promise<ConversationMessage> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${conversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const payload = res?.data ?? res ?? {};
        const item = payload?.data ?? payload;
        return mapConversationMessage(item);
    }
    await delay(DELAY_MS);
    return {
        id: `msg-${Date.now()}`,
        content: data.content,
        sender: { id: 'mock', name: 'Mock User', avatarUrl: null },
        createdAt: new Date().toISOString(),
    };
}

export async function markConversationRead(conversationId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/conversations/${conversationId}/read`, { method: 'POST' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

// =====================
// Parking Slots
// =====================

export async function getParkingSlots(buildingId: string, options?: { available?: boolean }): Promise<ParkingSlot[]> {
    if (!USE_MOCK) {
        const query = options?.available ? '?available=true' : '';
        const endpoint = `/org/buildings/${buildingId}/parking-slots${query}`;
        const res = await fetchJson(endpoint);

        // Some endpoints return arrays under different keys (e.g. `data.slots`, `data.parkingSlots`, etc.).
        // Be defensive so the "available slots" view doesn't silently become empty.
        let slots = getArray(res);
        if (slots.length === 0) {
            if (Array.isArray(res?.slots)) slots = res.slots;
            else if (Array.isArray(res?.parkingSlots)) slots = res.parkingSlots;
            else if (Array.isArray(res?.availableSlots)) slots = res.availableSlots;
            else if (Array.isArray(res?.data?.slots)) slots = res.data.slots;
            else if (Array.isArray(res?.data?.parkingSlots)) slots = res.data.parkingSlots;
            else if (Array.isArray(res?.data?.availableSlots)) slots = res.data.availableSlots;
            else if (Array.isArray(res?.data?.data)) slots = res.data.data;
            else {
                // Last resort: find a plausible array in the response (depth-limited).
                const queue: Array<{ value: any; depth: number }> = [{ value: res, depth: 0 }];
                const candidates: any[][] = [];

                while (queue.length) {
                    const { value, depth } = queue.shift()!;
                    if (!value || typeof value !== 'object') continue;
                    if (depth > 3) continue;

                    for (const key of Object.keys(value)) {
                        const next = (value as any)[key];
                        if (Array.isArray(next)) {
                            const looksLikeSlot = next.some((item) => item && typeof item === 'object' && ('code' in item || 'slotCode' in item) && ('id' in item || 'slotId' in item));
                            const looksLikeList = next.length > 0 && next.every((item) => item && typeof item === 'object');
                            if (looksLikeSlot || looksLikeList) candidates.push(next);
                        } else if (next && typeof next === 'object') {
                            queue.push({ value: next, depth: depth + 1 });
                        }
                    }
                }

                if (candidates.length) {
                    candidates.sort((a, b) => b.length - a.length);
                    slots = candidates[0];
                }
            }
        }

        if (IS_DEV && options?.available) {
            const topKeys = res && typeof res === 'object' ? Object.keys(res) : [];
            const dataKeys = res?.data && typeof res.data === 'object' ? Object.keys(res.data) : [];
            console.log('[API] getParkingSlots parsed', { endpoint, topKeys, dataKeys, slotCount: slots.length });
            if (slots.length === 0) {
                console.log('[API] getParkingSlots raw (truncated)', {
                    endpoint,
                    res: truncateForLog(res),
                });
            }
        }

        const hasAvailabilityBoolean = slots.some((s: any) =>
            typeof s?.isAvailable === 'boolean' ||
            typeof s?.available === 'boolean' ||
            typeof s?.isVacant === 'boolean' ||
            typeof s?.vacant === 'boolean'
        );

        const mapped = slots.map((s: any) => {
            const availability =
                typeof s?.isAvailable === 'boolean'
                    ? s.isAvailable
                    : typeof s?.available === 'boolean'
                        ? s.available
                        : typeof s?.isVacant === 'boolean'
                            ? s.isVacant
                            : typeof s?.vacant === 'boolean'
                                ? s.vacant
                                : undefined;

            return {
                id: String(s.id ?? ''),
                buildingId: String(s.buildingId ?? buildingId),
                code: s.code ?? '',
                level: s.level ?? null,
                type: (s.type ?? 'CAR') as ParkingSlotType,
                isCovered: Boolean(s.isCovered),
                isActive: s.isActive !== false,
                createdAt: s.createdAt ?? new Date().toISOString(),
                __available: availability as boolean | undefined,
            };
        });

        const filtered = options?.available && hasAvailabilityBoolean
            ? mapped.filter((s) => s.__available === true)
            : mapped;

        return filtered.map(({ __available, ...slot }) => slot);
    }
    await delay(DELAY_MS);
    return [];
}

export async function createParkingSlot(
    buildingId: string,
    data: { code: string; type: ParkingSlotType; level?: string; isCovered?: boolean }
): Promise<ParkingSlot> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/parking-slots`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const slot = res?.data ?? res;
        return {
            id: String(slot.id ?? ''),
            buildingId: String(slot.buildingId ?? buildingId),
            code: slot.code ?? data.code,
            level: slot.level ?? data.level ?? null,
            type: (slot.type ?? data.type) as ParkingSlotType,
            isCovered: Boolean(slot.isCovered ?? data.isCovered),
            isActive: slot.isActive !== false,
            createdAt: slot.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(Date.now()),
        buildingId,
        code: data.code,
        level: data.level ?? null,
        type: data.type,
        isCovered: data.isCovered ?? false,
        isActive: true,
        createdAt: new Date().toISOString(),
    };
}

export async function updateParkingSlot(
    slotId: string,
    data: { code?: string; type?: ParkingSlotType; level?: string; isCovered?: boolean; isActive?: boolean }
): Promise<ParkingSlot> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/parking-slots/${slotId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const slot = res?.data ?? res;
        return {
            id: String(slot.id ?? slotId),
            buildingId: String(slot.buildingId ?? ''),
            code: slot.code ?? '',
            level: slot.level ?? null,
            type: (slot.type ?? 'CAR') as ParkingSlotType,
            isCovered: Boolean(slot.isCovered),
            isActive: slot.isActive !== false,
            createdAt: slot.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(DELAY_MS);
    return {
        id: slotId,
        buildingId: '',
        code: data.code ?? '',
        level: data.level ?? null,
        type: data.type ?? 'CAR',
        isCovered: data.isCovered ?? false,
        isActive: data.isActive ?? true,
        createdAt: new Date().toISOString(),
    };
}

// =====================
// Parking Allocations
// =====================

export async function getOccupancyParkingAllocations(
    occupancyId: string,
    options?: { active?: boolean }
): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        let query = '';
        if (options?.active === true) query = '?active=true';
        else if (options?.active === false) query = '?active=false';
        const res = await fetchJson(`/org/occupancies/${occupancyId}/parking-allocations${query}`);
        const allocations = getArray(res);
        return allocations.map((a: any) => ({
            id: String(a.id ?? ''),
            buildingId: String(a.buildingId ?? ''),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : String(occupancyId),
            unitId: a.unitId != null ? String(a.unitId) : undefined,
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? new Date().toISOString(),
            endDate: a.endDate ?? null,
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        }));
    }
    await delay(DELAY_MS);
    return [];
}


export async function createParkingAllocations(
    buildingId: string,
    data: { occupancyId?: string; unitId?: string; slotIds?: string[]; count?: number }
): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/parking-allocations`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const allocations = getArray(res);
        return allocations.map((a: any) => ({
            id: String(a.id ?? ''),
            buildingId: String(a.buildingId ?? buildingId),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : (data.occupancyId ? String(data.occupancyId) : undefined),
            unitId: a.unitId != null ? String(a.unitId) : (data.unitId ? String(data.unitId) : undefined),
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? new Date().toISOString(),
            endDate: a.endDate ?? null,
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function getUnitParkingAllocations(unitId: string): Promise<ParkingAllocation[]> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                `/org/units/${unitId}/parking-allocations`,
                undefined,
                { silentStatusCodes: [404] }
            );
            const allocations = getArray(res);
            return allocations.map((a: any) => ({
                id: String(a.id ?? ''),
                buildingId: String(a.buildingId ?? ''),
                occupancyId: a.occupancyId != null ? String(a.occupancyId) : undefined,
                unitId: a.unitId != null ? String(a.unitId) : unitId,
                parkingSlotId: String(a.parkingSlotId ?? ''),
                startDate: a.startDate ?? new Date().toISOString(),
                endDate: a.endDate ?? null,
                slot: {
                    id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                    code: a.slot?.code ?? '',
                    level: a.slot?.level ?? null,
                    type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
                },
            }));
        } catch (error) {
            if ((error as any)?.silent || (error instanceof Error && /404/.test(error.message))) {
                return [];
            }
            throw error;
        }
    }
    await delay(DELAY_MS);
    return [];
}

export async function endAllUnitParkingAllocations(unitId: string, data?: { endDate?: string }): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        try {
            const res = await fetchJson(
                `/org/units/${unitId}/parking-allocations/end-all`,
                {
                    method: 'POST',
                    body: JSON.stringify(data ?? {}),
                },
                { silentStatusCodes: [404] }
            );
            return res?.data ?? res ?? { success: true };
        } catch (error) {
            if ((error as any)?.silent || (error instanceof Error && /404/.test(error.message))) {
                return { success: false };
            }
            throw error;
        }
    }
    await delay(DELAY_MS);
    return { success: true };
}

export async function endParkingAllocation(
    allocationId: string,
    data?: { endDate?: string }
): Promise<ParkingAllocation> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/parking-allocations/${allocationId}/end`, {
            method: 'POST',
            body: JSON.stringify(data ?? {}),
        });
        const a = res?.data ?? res;
        return {
            id: String(a.id ?? allocationId),
            buildingId: String(a.buildingId ?? ''),
            occupancyId: a.occupancyId != null ? String(a.occupancyId) : undefined,
            unitId: a.unitId != null ? String(a.unitId) : undefined,
            parkingSlotId: String(a.parkingSlotId ?? ''),
            startDate: a.startDate ?? '',
            endDate: a.endDate ?? new Date().toISOString(),
            slot: {
                id: String(a.slot?.id ?? a.parkingSlotId ?? ''),
                code: a.slot?.code ?? '',
                level: a.slot?.level ?? null,
                type: (a.slot?.type ?? 'CAR') as ParkingSlotType,
            },
        };
    }
    await delay(DELAY_MS);
    return {
        id: allocationId,
        buildingId: '',
        occupancyId: '',
        parkingSlotId: '',
        startDate: '',
        endDate: data?.endDate ?? new Date().toISOString(),
        slot: { id: '', code: '', level: null, type: 'CAR' },
    };
}

export async function endAllParkingAllocations(
    occupancyId: string,
    data?: { endDate?: string }
): Promise<{ ended: number }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/parking-allocations/end-all`, {
            method: 'POST',
            body: JSON.stringify(data ?? {}),
        });
        return { ended: res?.ended ?? res?.data?.ended ?? 0 };
    }
    await delay(DELAY_MS);
    return { ended: 0 };
}

// =====================
// Vehicles
// =====================

export async function getOccupancyVehicles(occupancyId: string): Promise<Vehicle[]> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/vehicles`);
        const vehicles = getArray(res);
        return vehicles.map((v: any) => ({
            id: String(v.id ?? ''),
            occupancyId: String(v.occupancyId ?? occupancyId),
            plateNumber: v.plateNumber ?? '',
            label: v.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        }));
    }
    await delay(DELAY_MS);
    return [];
}

export async function createVehicle(
    occupancyId: string,
    data: { plateNumber: string; label?: string }
): Promise<Vehicle> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/occupancies/${occupancyId}/vehicles`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const v = res?.data ?? res;
        return {
            id: String(v.id ?? ''),
            occupancyId: String(v.occupancyId ?? occupancyId),
            plateNumber: v.plateNumber ?? data.plateNumber,
            label: v.label ?? data.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(DELAY_MS);
    return {
        id: String(Date.now()),
        occupancyId,
        plateNumber: data.plateNumber,
        label: data.label ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function updateVehicle(
    vehicleId: string,
    data: { plateNumber?: string; label?: string }
): Promise<Vehicle> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/vehicles/${vehicleId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
        const v = res?.data ?? res;
        return {
            id: String(v.id ?? vehicleId),
            occupancyId: String(v.occupancyId ?? ''),
            plateNumber: v.plateNumber ?? '',
            label: v.label ?? null,
            createdAt: v.createdAt ?? new Date().toISOString(),
        };
    }
    await delay(DELAY_MS);
    return {
        id: vehicleId,
        occupancyId: '',
        plateNumber: data.plateNumber ?? '',
        label: data.label ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function deleteVehicle(vehicleId: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/vehicles/${vehicleId}`, { method: 'DELETE' });
        return res?.data ?? res ?? { success: true };
    }
    await delay(DELAY_MS);
    return { success: true };
}

// =====================
// Visitors
// =====================

const VISITOR_TYPES: VisitorType[] = [
    'GUEST_VISITOR',
    'DELIVERY_RIDER',
    'COURIER_PARCEL',
    'SERVICE_PROVIDER',
    'MAINTENANCE_TECHNICIAN',
    'HOUSEKEEPING_CLEANER',
    'CONTRACTOR_WORKER',
    'DRIVER_PICKUP',
    'SECURITY_STAFF_EXTERNAL',
    'OTHER'
];

const VISITOR_STATUSES: VisitorStatus[] = ['EXPECTED', 'ARRIVED', 'COMPLETED', 'CANCELLED'];

function resolveVisitorType(value: any): VisitorType {
    if (typeof value === 'string' && VISITOR_TYPES.includes(value as VisitorType)) {
        return value as VisitorType;
    }
    return 'GUEST_VISITOR';
}

function resolveVisitorStatus(value: any): VisitorStatus {
    if (typeof value === 'string' && VISITOR_STATUSES.includes(value as VisitorStatus)) {
        return value as VisitorStatus;
    }
    return 'EXPECTED';
}

function normalizeVisitor(v: any): Visitor {
    return {
        id: String(v.id ?? ''),
        buildingId: String(v.buildingId ?? ''),
        type: resolveVisitorType(v.type),
        status: resolveVisitorStatus(v.status),
        visitorName: v.visitorName ?? 'Visitor',
        phoneNumber: v.phoneNumber ?? undefined,
        emiratesId: v.emiratesId ?? null,
        vehicleNumber: v.vehicleNumber ?? null,
        expectedArrivalAt: v.expectedArrivalAt ?? null,
        notes: v.notes ?? null,
        unit: v.unit ? { id: String(v.unit.id), label: v.unit.label } : undefined,
        tenantName: v.tenantName ?? null,
        createdAt: v.createdAt ?? new Date().toISOString(),
        updatedAt: v.updatedAt ?? new Date().toISOString()
    };
}

export async function getVisitors(
    buildingId: string,
    filters?: { status?: VisitorStatus; unitId?: string }
): Promise<Visitor[]> {
    if (!USE_MOCK) {
        try {
            const params = new URLSearchParams();
            if (filters?.status) {
                params.append('status', filters.status);
            }
            if (filters?.unitId) {
                params.append('unitId', filters.unitId);
            }
            const queryStr = params.toString();
            const endpoint = `/org/buildings/${buildingId}/visitors${queryStr ? `?${queryStr}` : ''}`;
            const res = await fetchJson(endpoint);
            const visitors = getArray(res);
            return visitors.map(normalizeVisitor);
        } catch (e) {
            console.warn('[API] getVisitors failed', e);
            return [];
        }
    }
    await delay(DELAY_MS);
    return [];
}

export async function createVisitor(
    buildingId: string,
    data: {
        unitId: string;
        visitorName: string;
        phoneNumber?: string;
        type: VisitorType;
        emiratesId?: string;
        vehicleNumber?: string;
        expectedArrivalAt?: string;
        notes?: string;
    }
): Promise<Visitor> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/visitors`, {
            method: 'POST',
            body: JSON.stringify({
                unitId: data.unitId,
                visitorName: data.visitorName,
                phoneNumber: data.phoneNumber,
                type: data.type,
                emiratesId: data.emiratesId || undefined,
                vehicleNumber: data.vehicleNumber || undefined,
                expectedArrivalAt: data.expectedArrivalAt || undefined,
                notes: data.notes || undefined
            })
        });
        const visitor = res?.data ?? res;
        return normalizeVisitor(visitor);
    }
    await delay(DELAY_MS);
    return normalizeVisitor({
        id: `v-${Date.now()}`,
        buildingId,
        ...data,
        status: 'EXPECTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

export async function updateVisitor(
    buildingId: string,
    visitorId: string,
    data: {
        status?: VisitorStatus;
        type?: VisitorType;
        visitorName?: string;
        phoneNumber?: string;
        unitId?: string;
        emiratesId?: string;
        vehicleNumber?: string;
        expectedArrivalAt?: string | null;
        notes?: string;
    }
): Promise<Visitor> {
    if (!USE_MOCK) {
        const res = await fetchJson(`/org/buildings/${buildingId}/visitors/${visitorId}`, {
            method: 'PATCH',
            body: JSON.stringify({
                ...(data.status && { status: data.status }),
                ...(data.type && { type: data.type }),
                ...(data.visitorName && { visitorName: data.visitorName }),
                ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
                ...(data.unitId && { unitId: data.unitId }),
                ...(data.emiratesId !== undefined && { emiratesId: data.emiratesId }),
                ...(data.vehicleNumber !== undefined && { vehicleNumber: data.vehicleNumber }),
                ...(data.expectedArrivalAt !== undefined && { expectedArrivalAt: data.expectedArrivalAt }),
                ...(data.notes !== undefined && { notes: data.notes })
            })
        });
        const visitor = res?.data ?? res;
        return normalizeVisitor(visitor);
    }
    await delay(DELAY_MS);
    return normalizeVisitor({
        id: visitorId,
        buildingId,
        ...data,
        updatedAt: new Date().toISOString()
    });
}
