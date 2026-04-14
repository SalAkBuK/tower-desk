export const SIDEBAR_COLLAPSED_STORAGE_KEY = "towerdesk.sidebar.collapsed";

export const readSidebarCollapsedPreference = (storage?: Pick<Storage, "getItem"> | null) =>
    storage?.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";

export const writeSidebarCollapsedPreference = (
    storage: Pick<Storage, "setItem"> | null | undefined,
    collapsed: boolean,
) => {
    storage?.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "1" : "0");
};
