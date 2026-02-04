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
    createdAt?: string;
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
    data?: Record<string, unknown>;
    readAt?: string | null;
    createdAt?: string;
};

export type ConversationParticipant = {
    id: string;
    name?: string;
    email?: string;
    avatarUrl?: string | null;
};

export type ConversationMessage = {
    id: string;
    content: string;
    sender: ConversationParticipant;
    createdAt: string;
};

export type Conversation = {
    id: string;
    subject?: string | null;
    buildingId?: string | null;
    participants: ConversationParticipant[];
    unreadCount: number;
    lastMessage?: ConversationMessage | null;
    messages?: ConversationMessage[];
    createdAt: string;
    updatedAt: string;
};

export type CreateConversationInput = {
    participantUserIds: string[];
    subject?: string;
    message: string;
    buildingId?: string;
};

export type ConversationListResponse = {
    items: Conversation[];
    nextCursor?: string | null;
};

export type BroadcastSender = {
    id: string;
    name?: string;
    email?: string;
};

export type BroadcastAudience =
    | "tenants"
    | "admins"
    | "staff"
    | "managers"
    | "building_admins"
    | "all_users";

export type Broadcast = {
    id: string;
    title: string;
    body?: string;
    buildingIds: string[];
    recipientCount: number;
    sender: BroadcastSender;
    createdAt: string;
};

export type CreateBroadcastInput = {
    title: string;
    body?: string;
    buildingIds?: string[];
    audiences?: BroadcastAudience[];
};

export type BroadcastListResponse = {
    items: Broadcast[];
    nextCursor?: string | null;
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
    | 'create:requests'
    | 'messaging.read'
    | 'messaging.write';

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

export type UnitStatus = 'AVAILABLE' | 'OCCUPIED' | 'UNDER_MAINTENANCE' | 'BLOCKED';

export type UnitLeaseSummary = {
    id: string;
    leaseStartDate?: string;
    leaseEndDate?: string;
    tenancyRegistrationExpiry?: string;
    noticeGivenDate?: string;
    annualRent?: string;
    status?: LeaseStatus;
};

export type UnitOccupancySummary = {
    id: string;
    status?: string;
    resident?: {
        id: string;
        name?: string | null;
        email?: string | null;
    };
    lease?: UnitLeaseSummary;
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
    unitSizeUnit: UnitSizeUnit;
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
    status?: UnitStatus;
    occupancy?: UnitOccupancySummary;
};

export type UnitsImportMode = "create" | "upsert";

export type UnitsImportSummary = {
    totalRows?: number;
    validRows?: number;
    created?: number;
    updated?: number;
    total?: number;
    skipped?: number;
    failed?: number;
};

export type UnitsImportError = {
    row: number;
    field?: string;
    message: string;
};

export type UnitsImportResponse = {
    dryRun?: boolean;
    mode?: UnitsImportMode;
    summary: UnitsImportSummary;
    errors: UnitsImportError[];
    unitIds?: string[];
};

export type ParkingSlotsImportMode = "create" | "upsert";

export type ParkingSlotsImportSummary = {
    totalRows?: number;
    validRows?: number;
    created?: number;
    updated?: number;
    total?: number;
    skipped?: number;
    failed?: number;
};

export type ParkingSlotsImportError = {
    row: number;
    field?: string;
    message: string;
};

export type ParkingSlotsImportResponse = {
    dryRun?: boolean;
    mode?: ParkingSlotsImportMode;
    summary: ParkingSlotsImportSummary;
    errors: ParkingSlotsImportError[];
    slotIds?: string[];
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

export type MaintenancePayer = 'OWNER' | 'TENANT' | 'BUILDING';
export type UnitSizeUnit = 'SQ_FT';
export type KitchenType = 'OPEN' | 'CLOSED';
export type FurnishedStatus = 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FULLY_FURNISHED';
export type PaymentFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL';

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
        floor?: number;
        bedrooms?: number;
        bathrooms?: number;
        unitSize?: number;
        unitSizeUnit?: UnitSizeUnit;
        furnishedStatus?: FurnishedStatus;
        unitType?: { id: string; name?: string } | null;
    };
    status?: string;
    startAt?: string;
    endAt?: string;
    phoneNumber?: string;
    avatarUrl?: string;
    isActive?: boolean;
};
export type OccupancyUnitDto = {
  id: string;
  label: string;
};

export type OccupancyResidentDto = {
  id: string;
  email: string;
  name?: string | null;
};

export type OccupancyResponseDto = {
  id: string;
  buildingId: string;
  unitId: string;
  residentUserId: string;
  status: string;       // or a union if you want
  startAt: string;      // Dates arrive as ISO strings in FE
  endAt?: string | null;

  unit: OccupancyUnitDto;
  resident: OccupancyResidentDto;
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
    // Nested objects from API (newer format)
    unit?: {
        id: string;
        label: string;
    };
    resident?: {
        id: string;
        email?: string;
        name?: string;
    };
};

export type ResidentDirectoryLease = {
    leaseId: string;
    status?: string;
    leaseStartDate?: string | null;
    leaseEndDate?: string | null;
    annualRent?: string | number | null;
};

export type ResidentDirectoryProfile = {
    emiratesIdNumber?: string | null;
    passportNumber?: string | null;
    nationality?: string | null;
    dateOfBirth?: string | null;
    currentAddress?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
};

export type LastOccupancy = {
    buildingName: string;
    unitLabel: string;
    endAt: string | null;
};

export type ResidentStatusCategory = 'ACTIVE' | 'NEW' | 'FORMER';

export type ActiveOccupancy = {
    buildingId: string;
    unitId: string;
    unitLabel?: string | null;
    buildingName?: string | null;
};

export type OrgResidentListItem = {
    user: User;
    hasActiveOccupancy: boolean;
    occupancyId?: string | null;
    activeOccupancy?: ActiveOccupancy | null;
    residentStatus?: ResidentStatusCategory;
    lastOccupancy?: LastOccupancy | null;
    residentProfile?: ResidentDirectoryProfile | null;
};

export type OrgResidentsResponse = {
    items: OrgResidentListItem[];
    nextCursor?: string | null;
};

export type ResidentDirectoryRow = {
    occupancyId: string;
    residentUserId: string;
    residentName?: string | null;
    residentEmail?: string | null;
    residentPhone?: string | null;
    residentAvatarUrl?: string | null;
    unitId?: string | null;
    unitLabel?: string | null;
    status?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    profile?: ResidentDirectoryProfile | null;
    lease?: ResidentDirectoryLease | null;
};

export type ResidentDirectoryResponse = {
    items: ResidentDirectoryRow[];
    nextCursor?: string | null;
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
    occupancyId?: string | null;
    unitId?: string | null;
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

// Visitor Types
export type VisitorType =
    | 'GUEST_VISITOR'
    | 'DELIVERY_RIDER'
    | 'COURIER_PARCEL'
    | 'SERVICE_PROVIDER'
    | 'MAINTENANCE_TECHNICIAN'
    | 'HOUSEKEEPING_CLEANER'
    | 'CONTRACTOR_WORKER'
    | 'DRIVER_PICKUP'
    | 'SECURITY_STAFF_EXTERNAL'
    | 'OTHER';

export type VisitorStatus = 'EXPECTED' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';

// Lease-related enums
export type AccessItemStatus = 'ISSUED' | 'RETURNED' | 'DEACTIVATED';
export type LeaseStatus = 'ACTIVE' | 'ENDED';
export type YesNo = 'YES' | 'NO';
export type ConditionStatus = 'OK' | 'REPAIR_NEEDED';
export type ApprovalStatus = 'APPROVED' | 'PENDING' | 'REJECTED';
export type RefundMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH';

// Lease DTOs
export type CreateLeaseAccessCardsDto = { cardNumbers: string[] };
export type CreateLeaseParkingStickersDto = { stickerNumbers: string[] };
export type ReplaceLeaseOccupantsDto = { names: string[] };
export type UpdateAccessItemStatusDto = { status: AccessItemStatus };

// Lease entity types
export type LeaseAccessCard = {
    id: string;
    leaseId: string;
    cardNumber: string;
    status: AccessItemStatus;
    createdAt: string;
    updatedAt: string;
};

export type LeaseParkingSticker = {
    id: string;
    leaseId: string;
    stickerNumber: string;
    status: AccessItemStatus;
    createdAt: string;
    updatedAt: string;
};

export type LeaseOccupant = {
    id: string;
    leaseId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
};

// Additional lease enums
export type LeaseDocumentType =
    | 'EMIRATES_ID_COPY'
    | 'PASSPORT_COPY'
    | 'SIGNED_TENANCY_CONTRACT'
    | 'CHEQUE_COPY'
    | 'OTHER';

export type ServiceChargesPaidBy = 'OWNER' | 'TENANT';

// Lease entity
export type Lease = {
    id: string;
    buildingId: string;
    unitId: string;
    residentUserId: string;
    status: LeaseStatus;
    leaseStartDate: string;
    leaseEndDate: string;
    annualRent: string; // Decimal as string
    paymentFrequency: PaymentFrequency;
    numberOfCheques?: number;
    securityDepositAmount: string; // Decimal as string
    internetTvProvider?: string;
    serviceChargesPaidBy?: ServiceChargesPaidBy;
    vatApplicable?: boolean;
    notes?: string;
    firstPaymentReceived?: YesNo;
    firstPaymentAmount?: string;
    depositReceived?: YesNo;
    depositReceivedAmount?: string;
    actualMoveOutDate?: string;
    tenancyRegistrationExpiry?: string;
    noticeGivenDate?: string;
    createdAt: string;
    updatedAt: string;
    // Relations (optional, may be included in responses)
    unit?: {
        id: string;
        label: string;
        floor?: number | null;
        bedrooms?: number | null;
        bathrooms?: number | null;
        unitSize?: number | null;
        unitSizeUnit?: UnitSizeUnit | null;
        furnishedStatus?: FurnishedStatus | null;
        unitType?: { id: string; name?: string } | null;
    };
    resident?: {
        id: string;
        name?: string;
        email?: string;
    };
};

// Lease document entity
export type LeaseDocument = {
    id: string;
    leaseId: string;
    type: LeaseDocumentType;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
    createdAt: string;
    updatedAt: string;
};

// Move-in document DTO (for creating documents during move-in)
export type MoveInDocumentDto = {
    type: LeaseDocumentType;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
};

// Move-in DTO
export type MoveInDto = {
    unitId: string;
    residentUserId?: string;
    resident?: {
        name: string;
        email: string;
        phone?: string;
        password?: string;
    };
    residentProfile?: {
        emiratesIdNumber?: string;
        passportNumber?: string;
        nationality?: string;
        dateOfBirth?: string;
        currentAddress?: string;
        emergencyContactName?: string;
        emergencyContactPhone?: string;
    };
    leaseStartDate: string;
    leaseEndDate: string;
    annualRent: string;
    paymentFrequency: PaymentFrequency;
    numberOfCheques?: number;
    securityDepositAmount: string;
    internetTvProvider?: string;
    serviceChargesPaidBy?: ServiceChargesPaidBy;
    vatApplicable?: boolean;
    notes?: string;
    firstPaymentReceived?: YesNo;
    firstPaymentAmount?: string;
    depositReceived?: YesNo;
    depositReceivedAmount?: string;
    tenancyRegistrationExpiry?: string;
    noticeGivenDate?: string;
    occupantNames?: string[];
    parkingSlotIds?: string[];
    vehiclePlateNumbers?: string[];
    accessCardNumbers?: string[];
    parkingStickerNumbers?: string[];
    documents?: MoveInDocumentDto[];
};

// Move-out DTO
export type MoveOutDto = {
    actualMoveOutDate: string;
    forwardingPhone?: string;
    forwardingEmail?: string;
    forwardingAddress?: string;
    finalElectricityReading?: string;
    finalWaterReading?: string;
    finalGasReading?: string;
    wallsCondition?: ConditionStatus;
    floorCondition?: ConditionStatus;
    kitchenCondition?: ConditionStatus;
    bathroomCondition?: ConditionStatus;
    doorsLocksCondition?: ConditionStatus;
    keysReturned?: YesNo;
    accessCardsReturnedCount?: number;
    parkingStickersReturned?: YesNo;
    damageDescription?: string;
    damageCharges?: string;
    pendingRent?: string;
    pendingUtilities?: string;
    pendingServiceFines?: string;
    totalDeductions?: string;
    netRefund?: string;
    inspectionDoneBy?: string;
    inspectionDate?: string;
    managerApproval?: ApprovalStatus;
    refundMethod?: RefundMethod;
    refundDate?: string;
    adminNotes?: string;
    markAllAccessCardsReturned?: boolean;
    markAllParkingStickersReturned?: boolean;
};

// Create lease document DTO
export type CreateLeaseDocumentDto = {
    type: LeaseDocumentType;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
};

export type Visitor = {
    id: string;
    buildingId: string;
    type: VisitorType;
    status: VisitorStatus;
    visitorName: string;
    phoneNumber?: string;
    emiratesId?: string | null;
    vehicleNumber?: string | null;
    expectedArrivalAt?: string | null;
    notes?: string | null;
    unit?: {
        id: string;
        label: string;
    };
    tenantName?: string | null;
    createdAt: string;
    updatedAt: string;
};
