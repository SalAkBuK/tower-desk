export type BaseRole = 'superadmin' | 'admin' | 'org_admin' | 'building_admin' | 'manager' | 'service_provider' | 'employee' | 'tenant';
export type Role = BaseRole | string;

export type PermissionEffect = 'ALLOW' | 'DENY';

export type PermissionOverride = {
    permissionKey: string;
    effect: PermissionEffect;
};

export type AccessScopeType = "ORG" | "BUILDING";

export type AccessAssignment = {
    assignmentId?: string;
    roleId?: string;
    roleTemplateKey: string;
    roleTemplateName?: string;
    scopeType: AccessScopeType;
    scopeId: string | null;
    description?: string;
    buildingName?: string;
    permissionKeys?: string[];
};

export type UserOrgAccess = {
    roleId?: string;
    roleKey?: string;
    roleName?: string;
    description?: string;
};

export type UserBuildingAssignment = {
    id?: string;
    buildingId: string;
    buildingName?: string;
    type: "MANAGER" | "STAFF" | "BUILDING_ADMIN" | string;
    description?: string;
};

export type UserResidentLink = {
    occupancyId?: string;
    buildingId?: string;
    buildingName?: string;
    unitId?: string;
    unitLabel?: string;
    status?: string;
    mode?: "ADD" | "MOVE" | "MOVE_OUT" | string;
};

export type UserDisplayBadge = {
    key?: string;
    label: string;
    tone?: string;
};

export type UserDisplay = {
    primaryLabel?: string;
    badges?: UserDisplayBadge[];
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
    scopeType?: AccessScopeType;
    isSystem?: boolean;
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
    assignedRoles?: RoleDefinition[];
    effectivePermissions?: string[];
    orgAccess?: AccessAssignment[];
    buildingAccess?: AccessAssignment[];
    primaryOrgAccess?: UserOrgAccess | null;
    buildingAssignments?: UserBuildingAssignment[];
    resident?: UserResidentLink | null;
    display?: UserDisplay | null;
    permissionOverrides?: PermissionOverride[];
    isActive?: boolean;
    mustChangePassword?: boolean;
    // New fields from Admin API
    fullName?: string;
    phoneNumber?: string;
    address?: string;
    nationality?: string;
    createdAt?: string;
};

export type CurrentUserAccess = Pick<
    User,
    "orgAccess" | "buildingAccess" | "effectivePermissions" | "permissionOverrides" | "resident"
>;

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
    roleIds?: string[];
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

export type NotificationType =
    | "MOVE_IN_REQUEST_CREATED"
    | "MOVE_OUT_REQUEST_CREATED"
    | "REQUEST_CREATED"
    | "REQUEST_ASSIGNED"
    | "REQUEST_STATUS_CHANGED"
    | "REQUEST_COMMENTED"
    | "REQUEST_CANCELED";

export type NotificationItem = {
    id: string;
    type: NotificationType | string;
    title: string;
    body?: string;
    data?: Record<string, unknown>;
    readAt?: string | null;
    createdAt?: string;
};

export type DashboardOverviewSummary = {
    buildingsTotal: number;
    unitsTotal: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    activeLeases: number;
    openMaintenanceRequests: number;
    overdueMaintenanceRequests: number;
    visitorsToday: number;
    activeParkingAllocations: number;
    broadcastsLast30Days: number;
    unreadNotifications: number;
};

export type DashboardMaintenanceTrendPoint = {
    date: string;
    created: number;
    completed: number;
};

export type DashboardVisitorsTrendPoint = {
    date: string;
    created: number;
};

export type DashboardBroadcastsTrendPoint = {
    date: string;
    sent: number;
    recipientCount: number;
};

export type DashboardOverviewTrends = {
    maintenance: DashboardMaintenanceTrendPoint[];
    visitors: DashboardVisitorsTrendPoint[];
    broadcasts: DashboardBroadcastsTrendPoint[];
};

export type DashboardBuildingSummary = {
    buildingId: string;
    buildingName: string;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    activeLeases: number;
    openMaintenanceRequests: number;
    activeParkingAllocations: number;
    parkingSlotsTotal: number;
};

export type DashboardOverviewResponse = {
    generatedAt?: string;
    summary: DashboardOverviewSummary;
    trends: DashboardOverviewTrends;
    buildings: DashboardBuildingSummary[];
};

export type DashboardActivityType =
    | "maintenance.created"
    | "maintenance.completed"
    | "maintenance.canceled"
    | "visitor.created"
    | "broadcast.created"
    | "parking.allocated"
    | "parking.ended"
    | "lease.created"
    | string;

export type DashboardActivityItem = {
    type: DashboardActivityType;
    title: string;
    description?: string;
    entityType?: string;
    entityId?: string;
    buildingId?: string | null;
    buildingName?: string | null;
    occurredAt: string;
    metadata?: Record<string, unknown> | null;
};

export type DashboardActivityResponse = {
    items: DashboardActivityItem[];
    nextCursor?: string | null;
};

export type ConversationParticipant = {
    id: string;
    name?: string;
    email?: string;
    unitLabel?: string | null;
    buildingName?: string | null;
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
    unitLabel?: string | null;
    buildingName?: string | null;
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
    lease?: ResidentDirectoryLease | null;
    latestContractId?: string | null;
    canAddContract?: boolean;
    canViewContract?: boolean;
    canRequestMoveIn?: boolean;
    canRequestMoveOut?: boolean;
    canExecuteMoveOut?: boolean;
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
    latestContractId?: string | null;
    canAddContract?: boolean;
    canViewContract?: boolean;
    canRequestMoveIn?: boolean;
    canRequestMoveOut?: boolean;
    canExecuteMoveOut?: boolean;
};

export type ResidentDirectoryResponse = {
    items: ResidentDirectoryRow[];
    nextCursor?: string | null;
};

export type ResidentInviteStatus = 'PENDING' | 'ACCEPTED' | 'FAILED' | 'EXPIRED';
export type ResidentInviteFilterStatus = ResidentInviteStatus | 'ALL';

export type ResidentInviteListItem = {
    inviteId: string;
    status: ResidentInviteStatus;
    sentAt?: string | null;
    expiresAt?: string | null;
    acceptedAt?: string | null;
    failedAt?: string | null;
    failureReason?: string | null;
    user: {
        id: string;
        email: string;
        name?: string;
        isActive?: boolean;
        mustChangePassword?: boolean;
    };
    createdByUser?: {
        id: string;
        name?: string;
        email?: string;
    } | null;
};

export type ResidentInvitesResponse = {
    items: ResidentInviteListItem[];
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
export type LeaseStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
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
    occupancyId?: string | null;
    status: LeaseStatus;
    leaseStartDate: string;
    leaseEndDate: string;
    contractPeriodFrom?: string;
    contractPeriodTo?: string;
    ijariId?: string | null;
    contractDate?: string | null;
    propertyUsage?: string | null;
    ownerNameSnapshot?: string | null;
    landlordNameSnapshot?: string | null;
    tenantNameSnapshot?: string | null;
    tenantEmailSnapshot?: string | null;
    tenantPhoneSnapshot?: string | null;
    buildingNameSnapshot?: string | null;
    locationCommunity?: string | null;
    propertySizeSqm?: string | null;
    propertyTypeLabel?: string | null;
    propertyNumber?: string | null;
    premisesNoDewa?: string | null;
    plotNo?: string | null;
    annualRent: string; // Decimal as string
    paymentFrequency: PaymentFrequency;
    numberOfCheques?: number;
    securityDepositAmount: string; // Decimal as string
    contractValue?: string;
    paymentModeText?: string;
    additionalTerms?: string[];
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

export type LeaseHistoryAction = "CREATED" | "UPDATED" | "MOVED_OUT";

export type LeaseHistoryChangeValue = string | number | boolean | null;

export type LeaseHistoryChange = {
    from: LeaseHistoryChangeValue;
    to: LeaseHistoryChangeValue;
};

export type LeaseHistoryEntry = {
    id: string;
    action: LeaseHistoryAction;
    createdAt: string;
    changedByUser?: {
        id: string;
        name?: string;
        email?: string;
    } | null;
    changes: Record<string, LeaseHistoryChange>;
};

export type OrgLeaseStatusFilter = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED" | "ALL";

export type OrgLeasesQuery = {
    status?: OrgLeaseStatusFilter;
    buildingId?: string;
    unitId?: string;
    residentUserId?: string;
    q?: string;
    date_from?: string;
    date_to?: string;
    order?: TimelineOrder;
    cursor?: string;
    limit?: number;
};

export type OrgLeasesResponse = {
    items: Lease[];
    nextCursor?: string | null;
};

export type ResidentLeaseStatusFilter = "DRAFT" | "ACTIVE" | "ENDED" | "CANCELLED" | "ALL";
export type TimelineOrder = "asc" | "desc";

export type ResidentLeaseListQuery = {
    status?: ResidentLeaseStatusFilter;
    order?: TimelineOrder;
    cursor?: string;
    limit?: number;
};

export type ResidentLeaseListItem = {
    leaseId: string;
    status: LeaseStatus;
    leaseStartDate: string;
    leaseEndDate: string;
    actualMoveOutDate?: string | null;
    occupancyId?: string | null;
    building?: {
        id: string;
        name?: string | null;
    } | null;
    unit?: {
        id: string;
        label?: string | null;
    } | null;
};

export type ResidentLeaseListResponse = {
    items: ResidentLeaseListItem[];
    nextCursor?: string | null;
};

export type ResidentLeaseTimelineQuery = {
    action?: LeaseHistoryAction;
    order?: TimelineOrder;
    cursor?: string;
    limit?: number;
};

export type LeaseTimelineSource = "HISTORY" | "ACTIVITY";
export type LeaseTimelineSourceFilter = "ALL" | LeaseTimelineSource;

export type LeaseTimelineActivityAction =
    | "MOVE_IN"
    | "MOVE_OUT"
    | "DOCUMENT_ADDED"
    | "DOCUMENT_DELETED"
    | "ACCESS_CARD_ISSUED"
    | "ACCESS_CARD_STATUS_CHANGED"
    | "ACCESS_CARD_DELETED"
    | "PARKING_STICKER_ISSUED"
    | "PARKING_STICKER_STATUS_CHANGED"
    | "PARKING_STICKER_DELETED"
    | "OCCUPANTS_REPLACED"
    | "PARKING_ALLOCATED"
    | "PARKING_ALLOCATION_ENDED"
    | "VEHICLE_ADDED"
    | "VEHICLE_UPDATED"
    | "VEHICLE_DELETED";

export type LeaseTimelineQuery = {
    source?: LeaseTimelineSourceFilter;
    historyAction?: LeaseHistoryAction;
    activityAction?: LeaseTimelineActivityAction;
    date_from?: string;
    date_to?: string;
    order?: TimelineOrder;
    cursor?: string;
    limit?: number;
};

export type LeaseTimelineItem = {
    id: string;
    source: LeaseTimelineSource;
    action: LeaseHistoryAction | LeaseTimelineActivityAction | string;
    createdAt: string;
    changedByUser?: {
        id: string;
        name?: string;
        email?: string;
    } | null;
    payload?: Record<string, unknown> | null;
    leaseId?: string;
    lease?: {
        leaseId?: string;
        status?: LeaseStatus;
        leaseStartDate?: string | null;
        leaseEndDate?: string | null;
        buildingId?: string;
        unitId?: string;
    } | null;
};

export type LeaseTimelineResponse = {
    items: LeaseTimelineItem[];
    nextCursor?: string | null;
};

export type CreateContractDto = {
    unitId: string;
    residentUserId: string;
    contractPeriodFrom: string;
    contractPeriodTo: string;
    annualRent: string;
    paymentFrequency: PaymentFrequency;
    numberOfCheques?: number;
    securityDepositAmount?: string;
    ijariId?: string;
    contractDate?: string;
    propertyUsage?: string;
    ownerNameSnapshot?: string;
    landlordNameSnapshot?: string;
    tenantNameSnapshot?: string;
    tenantEmailSnapshot?: string;
    tenantPhoneSnapshot?: string;
    buildingNameSnapshot?: string;
    locationCommunity?: string;
    propertySizeSqm?: string;
    propertyTypeLabel?: string;
    propertyNumber?: string;
    premisesNoDewa?: string;
    plotNo?: string;
    contractValue?: string;
    paymentModeText?: string;
    additionalTerms?: string[];
};

// Lease update DTO (partial PATCH)
export type UpdateLeaseDto = {
    leaseStartDate?: string;
    leaseEndDate?: string;
    contractPeriodFrom?: string;
    contractPeriodTo?: string;
    contractDate?: string | null;
    ijariId?: string | null;
    propertyUsage?: string | null;
    ownerNameSnapshot?: string | null;
    landlordNameSnapshot?: string | null;
    tenantNameSnapshot?: string | null;
    tenantEmailSnapshot?: string | null;
    tenantPhoneSnapshot?: string | null;
    buildingNameSnapshot?: string | null;
    locationCommunity?: string | null;
    propertySizeSqm?: string | null;
    propertyTypeLabel?: string | null;
    propertyNumber?: string | null;
    premisesNoDewa?: string | null;
    plotNo?: string | null;
    tenancyRegistrationExpiry?: string | null;
    noticeGivenDate?: string | null;
    annualRent?: string;
    securityDepositAmount?: string;
    contractValue?: string;
    paymentModeText?: string;
    additionalTerms?: string[];
    firstPaymentAmount?: string;
    depositReceivedAmount?: string;
    paymentFrequency?: PaymentFrequency;
    numberOfCheques?: number;
    internetTvProvider?: string | null;
    notes?: string | null;
    serviceChargesPaidBy?: ServiceChargesPaidBy;
    vatApplicable?: boolean | null;
    firstPaymentReceived?: YesNo;
    depositReceived?: YesNo;
};

// Create lease document DTO
export type CreateLeaseDocumentDto = {
    type: LeaseDocumentType;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    url: string;
};

export type ContractMoveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
export type ContractMoveRequestStatusFilter = ContractMoveRequestStatus | 'ALL';

export type CreateContractMoveRequestDto = {
    requestedMoveAt: string;
    notes?: string;
};

export type RejectContractMoveRequestDto = {
    rejectionReason: string;
};

export type ContractMoveRequest = {
    id: string;
    contractId?: string;
    leaseId?: string;
    residentUserId: string;
    buildingId: string;
    unitId: string;
    status: ContractMoveRequestStatus;
    requestedMoveAt: string;
    notes?: string | null;
    reviewedByUserId?: string | null;
    reviewedAt?: string | null;
    rejectionReason?: string | null;
    createdAt: string;
    updatedAt: string;
    resident?: {
        id?: string;
        name?: string | null;
        email?: string | null;
    };
    unit?: {
        id?: string;
        label?: string | null;
    };
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
