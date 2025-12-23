export type Role = 'superadmin' | 'admin' | 'manager' | 'service_provider' | 'employee' | 'tenant';

export type User = {
    id: string;
    name: string;
    email: string; // Used for login
    role: Role;
    avatarUrl?: string;
    buildingIds: string[];
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
    phoneNumber: string;
    address: string;
    nationality: string;
    buildingId?: string | number;
    unitNumber?: string;
    floorNumber?: number;
    entranceDate?: string;
};

export type BuildingStatus = 'active' | 'maintenance' | 'inactive';

export type Building = {
    id: string;
    name: string;
    address: string;
    city?: string;
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
    address: string;
    city: string;
    unitsCount: number;
};


export type RequestStatus = 'pending' | 'assigned' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled';

export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RequestAttachment = {
    id: string;
    fileUrl: string;
    fileName: string;
    contentType: string;
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
