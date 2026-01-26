import { VisitorType, VisitorStatus } from '@/lib/types';

export const visitorTypeLabels: Record<VisitorType, string> = {
    GUEST_VISITOR: 'Guest',
    DELIVERY_RIDER: 'Delivery',
    COURIER_PARCEL: 'Courier',
    SERVICE_PROVIDER: 'Service Provider',
    MAINTENANCE_TECHNICIAN: 'Maintenance',
    HOUSEKEEPING_CLEANER: 'Housekeeping',
    CONTRACTOR_WORKER: 'Contractor',
    DRIVER_PICKUP: 'Driver',
    SECURITY_STAFF_EXTERNAL: 'Security',
    OTHER: 'Other'
};

export const visitorTypeStyles: Record<VisitorType, string> = {
    GUEST_VISITOR: 'bg-blue-50 text-blue-700 border-blue-200',
    DELIVERY_RIDER: 'bg-amber-50 text-amber-700 border-amber-200',
    COURIER_PARCEL: 'bg-orange-50 text-orange-700 border-orange-200',
    SERVICE_PROVIDER: 'bg-purple-50 text-purple-700 border-purple-200',
    MAINTENANCE_TECHNICIAN: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    HOUSEKEEPING_CLEANER: 'bg-pink-50 text-pink-700 border-pink-200',
    CONTRACTOR_WORKER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    DRIVER_PICKUP: 'bg-teal-50 text-teal-700 border-teal-200',
    SECURITY_STAFF_EXTERNAL: 'bg-slate-50 text-slate-700 border-slate-200',
    OTHER: 'bg-zinc-50 text-zinc-700 border-zinc-200'
};

export const visitorStatusLabels: Record<VisitorStatus, string> = {
    EXPECTED: 'Expected',
    ARRIVED: 'Arrived',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
};

export const visitorStatusStyles: Record<VisitorStatus, string> = {
    EXPECTED: 'bg-blue-50 text-blue-700 border-blue-200',
    ARRIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED: 'bg-zinc-50 text-zinc-700 border-zinc-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200'
};

export const visitorTypes: VisitorType[] = [
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

export const visitorStatuses: VisitorStatus[] = [
    'EXPECTED',
    'ARRIVED',
    'COMPLETED',
    'CANCELLED'
];
