import type { OrgBusinessType, OrgProfile, PlatformOrg, PlatformOrgAdmin } from '../types';
import { delay, USE_MOCK } from './config';
import { fetchJson } from './client';

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
    await delay(800);
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
    await delay(800);
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
