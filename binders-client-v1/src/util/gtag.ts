import { CookieStatus } from "./cookie";

export function maybeInitGtag(status: CookieStatus): void {
    if (status === CookieStatus.Accepted) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (<any>window).initGtag();
    }
}