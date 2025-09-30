import { CookieStatus } from "@binders/client/lib/util/cookie";
import { create } from "zustand";

const LOCAL_STORAGE_KEY = "analytics-cookie-status";

export type CookieConsentState = {
    cookieStatus: CookieStatus;
    saveCookieStatus: (status: CookieStatus) => void;
}

const isCookieStatusValid = (status: CookieStatus): boolean =>
    Object.values(CookieStatus).includes(status);

const saveToLocalStorage = (status: CookieStatus) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(status));
};

const getFromLocalStorage = (): CookieStatus | undefined => {
    const value = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (value == null) return undefined;
    const localValue = JSON.parse(value);
    return isCookieStatusValid(localValue) ? localValue : undefined;
};

export const usePublicUserCookieConsentStore = create<CookieConsentState>((set) => ({
    cookieStatus: getFromLocalStorage() ?? CookieStatus.Unassigned,
    saveCookieStatus: (status: CookieStatus) => {
        if (isCookieStatusValid(status)) {
            set({cookieStatus: status});
            saveToLocalStorage(status);
        }
    },
}));
