export type BaseRole = 'superadmin' | 'admin' | 'org_admin' | 'manager' | 'service_provider' | 'employee' | 'tenant';
export type Role = BaseRole | string;

export type PermissionEffect = 'ALLOW' | 'DENY';

export type PermissionOverride = {
    permissionKey: string;
    effect: PermissionEffect;
};

export type PermissionDefinition = {
    key: string;
    name?: string;
    description?: string;
};

export type UserEffectivePermissions = {
    userId: string;
    permissions: string[];
};

export type RoleDefinition = {
    id: string;
    key: string;
    name: string;
    description?: string;
    permissionKeys?: string[];
};

export type User = {
    id: string;
    name: string;
    email: string; // Used for login
    role: Role;
    baseRole?: BaseRole;
    avatarUrl?: string;
    buildingIds: string[];
    orgId?: string | null;
    orgRoleKeys?: string[];
    roleKeys?: string[];
    effectivePermissions?: string[];
    isActive?: boolean;
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
    buildingIds?: string[];
    unitId?: string;
    floorNumber?: number;
    entranceDate?: string;
    orgRoleKeys?: string[];
    assignmentType?: BaseRole;
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
    createdBy?: {
        id?: string;
        name?: string;
        fullName?: string;
        email?: string;
    };
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

export type OrgBusinessType = 'OWNER' | 'PROPERTY_MANAGEMENT' | 'FACILITY_MANAGEMENT' | 'DEVELOPER';

export type OrgProfile = {
    id: string;
    name: string;
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
    amenityIds?: string[];
    amenities?: Amenity[];
    isAvailable?: boolean;
};

export type UnitType = {
    id: string;
    name: string;
    isActive?: boolean;
};

export type Amenity = {
    id: string;
    name: string;
    isDefault?: boolean;
    isActive?: boolean;
};

export type MaintenancePayer = 'OWNER' | 'TENANT';
export type UnitSizeUnit = 'SQ_FT' | 'SQ_M';
export type KitchenType = 'OPEN' | 'CLOSED';
export type FurnishedStatus = 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';
export type PaymentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL';

export type Owner = {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
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
    phoneNumber?: string;
    avatarUrl?: string;
    isActive?: boolean;
};

export type BuildingOccupancy = {
    id: string;
    unitId: string;
    unitLabel?: string;
    residentUserId?: string;
    residentName?: string;
    residentEmail?: string;
    status?: string;
    startAt?: string;
    endAt?: string;
};

// Parking Types
export type ParkingSlotType = 'CAR' | 'BIKE' | 'EV';

export type ParkingSlot = {
    id: string;
    buildingId: string;
    code: string;
    level: string | null;
    type: ParkingSlotType;
    isCovered: boolean;
    isActive: boolean;
    createdAt: string;
};

export type ParkingAllocation = {
    id: string;
    buildingId: string;
    occupancyId: string;
    parkingSlotId: string;
    startDate: string;
    endDate: string | null;
    slot: {
        id: string;
        code: string;
        level: string | null;
        type: ParkingSlotType;
    };
};

export type Vehicle = {
    id: string;
    occupancyId: string;
    plateNumber: string;
    label: string | null;
    createdAt: string;
};
