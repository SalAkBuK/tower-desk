export const getPathWithoutSearchParams = (
    pathname: string,
    searchParams: { toString(): string },
    keys: string[],
) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    keys.forEach((key) => nextParams.delete(key));
    const nextQuery = nextParams.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
};

export const getPathWithSearchParam = (
    pathname: string,
    searchParams: { toString(): string },
    key: string,
    value?: string | null,
) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    const normalizedValue = value?.trim();
    if (normalizedValue) {
        nextParams.set(key, normalizedValue);
    } else {
        nextParams.delete(key);
    }
    const nextQuery = nextParams.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
};

export const getPathWithSearchParamUpdates = (
    pathname: string,
    searchParams: { toString(): string },
    updates: Record<string, string | null | undefined>,
) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
        const normalizedValue = value?.trim();
        if (normalizedValue) {
            nextParams.set(key, normalizedValue);
        } else {
            nextParams.delete(key);
        }
    });
    const nextQuery = nextParams.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ""}`;
};
