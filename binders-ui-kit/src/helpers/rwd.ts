import vars from "../variables";

export function isMobileView(): boolean {
    return window.innerWidth < vars.sm.replace("px", "");
}

export function isMobilePortraitView(): boolean {
    return window.innerWidth < vars.mobileLandscape.replace("px", "");
}

export function isTabletView(): boolean {
    return window.innerWidth < vars.md.replace("px", "");
}

export interface RwdRecord {
    base: string;
    md?: string;
}

export function selectInRwdRecord(rwdRecord: RwdRecord): string {
    if (isMobileView()) {
        return rwdRecord.base;
    }
    return rwdRecord.md || rwdRecord.base;
}
