const LEGACY_DASHBOARD_PREFIX = /^\/(admin|manager)(\/.*)?$/;

export const normalizeToPortalPath = (pathname?: string | null) => {
    if (!pathname) return "";
    const match = pathname.match(LEGACY_DASHBOARD_PREFIX);
    if (!match) return pathname;
    const suffix = match[2] ?? "";
    return `/portal${suffix}`;
};

export const portalPath = (segment: string, ...parts: Array<string | number | null | undefined>) => {
    const normalizedSegment = String(segment ?? "").trim().replace(/^\/+|\/+$/g, "");
    const tail = parts
        .map((part) => String(part ?? "").trim())
        .filter(Boolean)
        .map((part) => part.replace(/^\/+|\/+$/g, ""));
    const joined = [normalizedSegment, ...tail].filter(Boolean).join("/");
    return `/portal/${joined}`;
};
