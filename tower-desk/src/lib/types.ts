export type Role = 'superadmin' | 'admin' | 'manager' | 'service_provider' | 'employee' | 'tenant';

export type User = {
    id: string;
    name: string;
    email: string; // Used for login
    role: Role;
    avatarUrl?: string;
    buildingIds: string[];
    orgId?: string | null;
    // New fields from Admin API
    fullName?: string;
    phoneNumber?: string;
    address?: string;
    nationality?: string;
};

// Admin DTO matching the API
export type AdminDTO = {
    id?: string; // Optional for create
    fullName: string;
    email?: string; // API shows email in create
    password?: string; // Only for create
    phoneNumber?: string;
    address?: string;
    nationality?: string;
    buildingId?: string | number;
    unitId?: string;
    floorNumber?: number;
    entranceDate?: string;
};

export type BuildingStatus = 'active' | 'maintenance' | 'inactive';

export type Building = {
    id: string;
    name: string;
    address?: string;
    city?: string;
    emirate?: string;
    country?: string;
    timezone?: string;
    floors?: number;
    unitsCount?: number;
    status: BuildingStatus;
    imageUrl?: string;
    stats?: {
        totalTenants: number;
        activeRequests: number;
        occupancyRate: number;
    };
};

export type BuildingDTO = {
    name: string;
    city: string;
    emirate?: string;
    country?: string;
    timezone?: string;
    floors?: number;
    unitsCount?: number;
};


export type RequestStatus = 'pending' | 'assigned' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';

export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RequestAttachment = {
    id: string;
    fileUrl: string;
    fileName: string;
    contentType: string;
    sizeBytes?: number;
    createdAt?: string;
};

export type NotificationItem = {
    id: string;
    type: string;
    title: string;
    body?: string;
    data?: Record<string, any>;
    readAt?: string | null;
    createdAt?: string;
};

export type RequestUnit = {
    id?: string;
    label?: string;
    number?: string | number;
    floor?: number;
};

export type RequestComment = {
    id: string;
    commentText: string;
    createdAt: string;
    user?: {
        userId: string;
        fullName?: string;
        email?: string;
    };
};

export type RequestStatusHistory = {
    id: string;
    oldStatus: RequestStatus;
    newStatus: RequestStatus;
    changedAt: string;
    note?: string | null;
};

export type ServiceRequest = {
    id: string;
    title: string;
    description: string;
    status: RequestStatus;
    priority: RequestPriority;
    buildingId: string;
    createdByTenantId: string;
    assignedEmployeeId?: string;
    createdAt: string;
    updatedAt: string;
    images?: string[];
    completedAt?: string | null;
    assignedTo?: {
        id: string;
        fullName?: string;
        email?: string;
    };
    unit?: RequestUnit;
    comments?: RequestComment[];
    attachments?: RequestAttachment[];
    statusHistory?: RequestStatusHistory[];
};

export type Permission =
    | 'manage:buildings'
    | 'view:buildings'
    | 'manage:users'
    | 'view:users'
    | 'manage:requests'
    | 'view:requests'
    | 'assign:requests'
    | 'create:requests';

export type PlatformOrg = {
    id: string;
    name: string;
    createdAt?: string;
};

export type PlatformOrgAdmin = {
    id: string;
    email: string;
    name?: string;
    orgId?: string | null;
};

export type BuildingUnit = {
    id: string;
    label: string;
    floor?: number;
    notes?: string;
    isAvailable?: boolean;
};

export type BuildingAssignment = {
    id: string;
    userId?: string;
    type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" | string;
    user?: {
        id: string;
        name?: string;
        email?: string;
    };
};

export type BuildingResident = {
    userId: string;
    name: string;
    email: string;
    unit?: {
        id: string;
        label: string;
    };
    status?: string;
    startAt?: string;
    endAt?: string;
};
