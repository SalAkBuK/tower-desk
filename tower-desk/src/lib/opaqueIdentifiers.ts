const HYPHENATED_OPAQUE_ID_PATTERN = /^[0-9a-f]{8,}(?:-[0-9a-f]{4,}){1,}$/i;
const COMPACT_OPAQUE_ID_PATTERN = /^(?:[0-9a-f]{24}|[0-9a-f]{32})$/i;
const OPAQUE_SUFFIX_PATTERN = /\s*(?:-|:|\/)\s*((?:[0-9a-f]{24}|[0-9a-f]{32}|[0-9a-f]{8,}(?:-[0-9a-f]{4,}){1,}))$/i;

const normalizeValue = (value?: string | null) => {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : undefined;
};

export const looksLikeOpaqueIdentifier = (value?: string | null) => {
    const normalized = normalizeValue(value);
    if (!normalized) return false;
    return HYPHENATED_OPAQUE_ID_PATTERN.test(normalized) || COMPACT_OPAQUE_ID_PATTERN.test(normalized);
};

export const sanitizeOpaqueLabel = (value?: string | null) => {
    const normalized = normalizeValue(value);
    if (!normalized) return undefined;
    if (looksLikeOpaqueIdentifier(normalized)) return undefined;

    const stripped = normalized.replace(OPAQUE_SUFFIX_PATTERN, "").trim();
    return stripped || normalized;
};

export const normalizeAccessDisplayLabel = (value?: string | null) => {
    const sanitized = sanitizeOpaqueLabel(value);
    if (!sanitized) return undefined;
    return sanitized.replace(/^building assignment\b/i, "Building Admin");
};

export const getPresentableScopeLabel = (preferred?: string | null, fallbackId?: string | null) =>
    sanitizeOpaqueLabel(preferred) ?? sanitizeOpaqueLabel(fallbackId);
