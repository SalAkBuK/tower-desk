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
