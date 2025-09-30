import CookieHelper from "../react/helpers/CookieHelper";

const COOKIE_BYPASS_CHECKLIST_PROGRESS = "bypass-checklist-progress";
const TEN_SECONDS_AS_DAYS = 10 / (60 * 60 * 24); // in days

export function setBypassChecklistBlockCookie(toTrue = true): void {
    new CookieHelper().setCookie(COOKIE_BYPASS_CHECKLIST_PROGRESS, toTrue ? 1 : 0, TEN_SECONDS_AS_DAYS);
}

export function isBypassChecklistBlockCookieSet(): boolean {
    const c = new CookieHelper().getCookie(COOKIE_BYPASS_CHECKLIST_PROGRESS);
    return c && c !== "0";
}

export enum CookieStatus {
    Accepted = "ACCEPTED",
    Rejected = "REJECTED",
    Unassigned = "UNASSIGNED",
}