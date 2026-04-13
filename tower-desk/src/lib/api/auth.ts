import type { BaseRole, User } from '../types';
import { DEBUG_AUTH, logAuth } from '../debugAuth';
import { useAuthStore } from '../auth';
import { logPortalEvent } from '../portalTelemetry';
import { normalizeUserFromApi } from '../userAccess';
import { createTimeoutController, fetchJson, redactLoginPayload, resolveAccessToken, resolveRefreshToken } from './client';
import { API_BASE_URL, delay, IS_DEV, mockData, USE_MOCK } from './config';
import { resolveRole } from './shared';

const hasExplicitRoleEvidence = (userData: any, payload?: any) => {
    const hasString = (value: unknown) => typeof value === "string" && value.trim().length > 0;
    const hasArray = (value: unknown) => Array.isArray(value) && value.length > 0;
    return Boolean(
        userData?.persona?.isPlatformAdmin === true
        || payload?.persona?.isPlatformAdmin === true
        || hasString(userData?.baseRole)
        || hasString(userData?.role)
        || hasString(userData?.persona?.role)
        || hasString(userData?.persona?.type)
        || hasString(payload?.baseRole)
        || hasString(payload?.role)
        || hasString(payload?.persona?.role)
        || hasString(payload?.persona?.type)
        || hasArray(userData?.roles)
        || hasArray(payload?.roles)
        || hasArray(userData?.roleKeys)
        || hasArray(payload?.roleKeys)
        || hasArray(userData?.orgRoleKeys)
        || hasArray(payload?.orgRoleKeys)
        || hasArray(userData?.orgAccess)
        || hasArray(payload?.orgAccess)
        || hasArray(userData?.buildingAccess)
        || hasArray(payload?.buildingAccess)
        || hasArray(userData?.buildingAssignments)
        || hasArray(payload?.buildingAssignments)
        || userData?.resident
        || payload?.resident
    );
};

const detectPortalRoleFromRuntime = async (accessToken: string): Promise<BaseRole | undefined> => {
    const headers = {
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
    };

    try {
        const providerRes = await fetch(`${API_BASE_URL}/provider/me`, {
            method: 'GET',
            headers,
        });
        if (providerRes.ok) {
            const providerJson = await providerRes.json();
            const providerPayload = providerJson?.data ?? providerJson ?? {};
            const providers = Array.isArray(providerPayload?.providers) ? providerPayload.providers : [];
            if (providers.length > 0) {
                return 'service_provider';
            }
        }
    } catch (e) {
        if (IS_DEV) {
            console.warn('[API] Provider runtime role probe failed', e);
        }
    }

    try {
        const ownerRes = await fetch(`${API_BASE_URL}/owner/portfolio/summary`, {
            method: 'GET',
            headers,
        });
        if (ownerRes.ok) {
            return 'owner';
        }
    } catch (e) {
        if (IS_DEV) {
            console.warn('[API] Owner runtime role probe failed', e);
        }
    }

    return undefined;
};

const shouldSkipScopedRoleHydration = (baseRole?: BaseRole, orgId?: string | null) =>
    baseRole === 'superadmin' && !orgId;

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

                const roleEvidencePresent = hasExplicitRoleEvidence(resolvedUserData, rolePayload);
                let baseRole: BaseRole | undefined = resolveRole(resolvedUserData, rolePayload);
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
                const shouldSkipRoleHydration = shouldSkipScopedRoleHydration(baseRole, orgId);
                const baseHeaders = accessToken
                    ? ({
                        accept: '*/*',
                        Authorization: `Bearer ${accessToken}`,
                        ...(orgId ? { 'x-org-id': String(orgId) } : {})
                    } as Record<string, string>)
                    : undefined;
                if (accessToken && baseHeaders && !shouldSkipRoleHydration && (!roleKeys?.length || !effectivePermissions?.length)) {
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
                                logPortalEvent('permission_resolution_fallback', {
                                    source: 'me_roles',
                                    context: 'login',
                                    count: resolved.length,
                                });
                            }
                        }
                    } catch (e) {
                        if (IS_DEV) {
                            console.warn('[API] Failed to hydrate permissions from /users/me/roles', e);
                        }
                    }
                }
                if (accessToken && !roleEvidencePresent) {
                    const detectedPortalRole = await detectPortalRoleFromRuntime(accessToken);
                    if (detectedPortalRole) {
                        baseRole = detectedPortalRole;
                    } else if (!roleEvidencePresent) {
                        baseRole = undefined;
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
                if (IS_DEV && accessToken) {
                    console.log('[Auth] Access token received');
                }
                const normalizedUser = normalizeUserFromApi(
                    {
                        ...resolvedUserData,
                        role: displayRole,
                        baseRole,
                        roleKeys,
                        orgRoleKeys,
                        effectivePermissions,
                    },
                    { fallbackEmail: email }
                );
                if (!normalizedUser) {
                    throw new Error('Failed to normalize login user');
                }
                return {
                    user: normalizedUser,
                    token: accessToken,
                    refreshToken
                };
            }
        } catch (e) {
            console.warn("Login API failed, falling back if allowed.", e);
            throw e;
        }
    }

    await delay(800);
    const user = mockData.users.find(u => u.email === email);
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
        const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? userData?.role ?? payload?.role ?? baseRole ?? 'user');
        const normalizedUser = normalizeUserFromApi(
            {
                ...userData,
                role: displayRole,
                baseRole,
                roleKeys,
                orgRoleKeys,
                effectivePermissions,
            },
            { fallbackEmail: email, fallbackName: name }
        );
        if (!normalizedUser) {
            throw new Error('Failed to normalize registered user');
        }
        return {
            user: normalizedUser,
            token: resolveAccessToken(payload, res),
            refreshToken: resolveRefreshToken(payload, res)
        };
    }
    await delay(800);
    const newUser: User = {
        id: `u${Math.random().toString(36).slice(2)}`,
        name: name || email,
        email,
        role: 'admin',
        baseRole: 'admin',
        buildingIds: [],
        fullName: name
    };
    mockData.users.push(newUser);
    return { user: newUser, token: null, refreshToken: null };
}

export async function forgotPassword(email: string): Promise<{ success: true }> {
    if (!USE_MOCK) {
        await fetchJson('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        return { success: true };
    }
    await delay(800);
    return { success: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: true }> {
    if (!USE_MOCK) {
        await fetchJson('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword })
        });
        return { success: true };
    }
    await delay(800);
    return { success: true };
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
        const normalizedUser = userData && displayRole
            ? normalizeUserFromApi(
                {
                    ...userData,
                    role: displayRole,
                    baseRole,
                    roleKeys,
                    orgRoleKeys,
                    effectivePermissions,
                }
            )
            : null;
        return {
            user: normalizedUser,
            token: resolveAccessToken(payload, res),
            refreshToken: resolveRefreshToken(payload, res) ?? refreshToken
        };
    }
    await delay(800);
    return { user: null, token: null, refreshToken: null };
}

export async function getCurrentUser(
    authToken?: string | null,
    options?: { timeoutMs?: number; rolesTimeoutMs?: number; signal?: AbortSignal }
): Promise<User | null> {
    if (!USE_MOCK) {
        const token = authToken ?? useAuthStore.getState().token;
        if (!token) return null;
        const timeoutMs = options?.timeoutMs ?? 8000;
        const rolesTimeoutMs = options?.rolesTimeoutMs ?? timeoutMs;
        const makeAuthError = (message: string, status?: number, code?: string) => {
            const error = new Error(message) as Error & { status?: number; code?: string };
            if (status) error.status = status;
            if (code) error.code = code;
            return error;
        };

        let res: Response;
        const { signal, cancel } = createTimeoutController(timeoutMs, options?.signal);
        try {
            res = await fetch(`${API_BASE_URL}/users/me`, {
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    Authorization: `Bearer ${token}`
                },
                signal
            });
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
                throw makeAuthError('Request timeout', undefined, 'timeout');
            }
            throw makeAuthError('Network error', undefined, 'network');
        } finally {
            cancel();
        }

        if (res.status === 401 || res.status === 403) {
            throw makeAuthError('Unauthorized', res.status, 'unauthorized');
        }
        if (!res.ok) {
            throw makeAuthError(`Failed to load user (${res.status})`, res.status, 'server');
        }

        const meJson = await res.json();
        const mePayload = meJson?.data ?? meJson;
        const userData = mePayload?.user ?? mePayload?.data?.user ?? mePayload?.data ?? mePayload ?? null;
        if (!userData || typeof userData !== 'object') return null;

        const baseRole = resolveRole(userData, mePayload);
        const preferNonEmptyArray = (...candidates: any[]) => {
            for (const candidate of candidates) {
                if (Array.isArray(candidate) && candidate.length > 0) return candidate;
            }
            return undefined;
        };
        let roleKeys = preferNonEmptyArray(
            userData?.roleKeys,
            mePayload?.roleKeys
        );
        const orgRoleKeys = preferNonEmptyArray(
            userData?.orgRoleKeys,
            mePayload?.orgRoleKeys
        );
        let effectivePermissions = preferNonEmptyArray(
            userData?.effectivePermissions,
            mePayload?.effectivePermissions,
            mePayload?.permissions,
            mePayload?.perms
        );
        const selectedOrgId = useAuthStore.getState().selectedOrgId ?? null;
        const orgId = selectedOrgId ?? userData?.orgId ?? mePayload?.orgId ?? null;
        const shouldSkipRoleHydration = shouldSkipScopedRoleHydration(baseRole, orgId);
        const baseHeaders = {
            accept: '*/*',
            Authorization: `Bearer ${token}`,
            ...(orgId ? { 'x-org-id': String(orgId) } : {})
        } as Record<string, string>;

        if ((!roleKeys?.length || !effectivePermissions?.length) && baseHeaders.Authorization && !shouldSkipRoleHydration) {
            try {
                const { signal: rolesSignal, cancel: cancelRoles } = createTimeoutController(rolesTimeoutMs, options?.signal);
                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'me_roles_request', { reason: 'missing_permissions' });
                }
                let meRolesRes: Response;
                try {
                    meRolesRes = await fetch(`${API_BASE_URL}/users/me/roles`, {
                        method: 'GET',
                        headers: baseHeaders,
                        signal: rolesSignal
                    });
                } catch (e) {
                    if (e instanceof DOMException && e.name === 'AbortError') {
                        throw makeAuthError('Request timeout', undefined, 'timeout');
                    }
                    throw makeAuthError('Network error', undefined, 'network');
                } finally {
                    cancelRoles();
                }
                if (DEBUG_AUTH) {
                    logAuth('AUTH', 'me_roles_response', { status: meRolesRes.status });
                }
                if (meRolesRes.status === 401 || meRolesRes.status === 403) {
                    throw makeAuthError('Unauthorized', meRolesRes.status, 'unauthorized');
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
                        logPortalEvent('permission_resolution_fallback', {
                            source: 'me_roles',
                            context: 'current_user',
                            count: resolved.length,
                        });
                    }
                }
            } catch (e) {
                if (e instanceof Error && (e as any).status && ((e as any).status === 401 || (e as any).status === 403)) {
                    throw e;
                }
                if (IS_DEV) {
                    console.warn('[API] Failed to hydrate permissions from /users/me/roles', e);
                }
            }
        }

        const displayRole = String(orgRoleKeys?.[0] ?? roleKeys?.[0] ?? userData?.role ?? mePayload?.role ?? baseRole ?? 'user');
        if (DEBUG_AUTH) {
            logAuth('AUTH', 'me_permissions', {
                role: displayRole,
                baseRole,
                roleKeys: roleKeys ?? [],
                orgRoleKeys: orgRoleKeys ?? [],
                effectivePermissions: effectivePermissions ?? []
            });
        }
        return normalizeUserFromApi({
            ...userData,
            role: displayRole,
            baseRole,
            roleKeys,
            orgRoleKeys,
            effectivePermissions,
        });
    }
    await delay(800);
    return null;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    if (!USE_MOCK) {
        const res = await fetchJson('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        return res?.data ?? res ?? { success: true };
    }
    await delay(800);
    return { success: true };
}
