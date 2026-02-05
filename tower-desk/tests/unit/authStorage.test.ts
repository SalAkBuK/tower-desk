import { describe, expect, it } from 'vitest';
import { parseAuthStorageValue, sanitizePersistedAuthState } from '../../src/lib/authStorage';

describe('auth storage parsing', () => {
    it('returns null for invalid JSON', () => {
        expect(parseAuthStorageValue('{not-json')).toBeNull();
    });

    it('returns null for missing required fields', () => {
        expect(sanitizePersistedAuthState({ token: 'x' })).toBeNull();
        expect(sanitizePersistedAuthState({ token: 'x', refreshToken: 'y' })).toBeNull();
    });

    it('rejects invalid user objects', () => {
        expect(
            sanitizePersistedAuthState({
                token: 'token',
                refreshToken: 'refresh',
                user: {},
                selectedOrgId: null,
                selectedBuildingId: null
            })
        ).toBeNull();
    });

    it('accepts minimal valid payload', () => {
        const state = sanitizePersistedAuthState({
            token: 'token',
            refreshToken: 'refresh',
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null
        });
        expect(state).toEqual({
            token: 'token',
            refreshToken: 'refresh',
            user: null,
            selectedOrgId: null,
            selectedBuildingId: null
        });
    });
});
