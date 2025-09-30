import { UAParser } from "ua-parser-js";

export function isIE10Plus(): boolean {
    if (!window) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.hasOwnProperty.call(window, "ActiveXObject") && !(<any>window).ActiveXObject) {
        return true;
    }
    else {
        return false;
    }
}

export function isMobileSafari(userAgent: string): boolean {
    const parser = new UAParser(userAgent);
    return parser.getBrowser()?.name === "Mobile Safari";
}

function extractMajorVersion(version: string): number {
    const matches = version && version.match(/([1-9][0-9]*)\.[1-9][0-9]*\.[1-9][0-9]*/);
    if (!version || matches === null) {
        return 999;
    }
    return Number.parseInt(matches[1], 10);
}

export function isAndroid(userAgent: string, minMajorVersion = 1, maxMajorVersion = 999): boolean {
    const parser = new UAParser(userAgent);
    const os = parser.getOS();
    const name = os?.name;
    const version = os?.version;
    const majorVersion = extractMajorVersion(version);
    return name?.startsWith("Android") &&
        majorVersion >= minMajorVersion &&
        majorVersion <= maxMajorVersion;
}

export function isChrome(userAgent: string): boolean {
    const parser = new UAParser(userAgent);
    return parser.getBrowser()?.name?.includes("Chrom");
}

// The app called "Samsung Internet" on most samsung devices
export function isMobileSamsungBrowser(userAgent: string): boolean {
    const parser = new UAParser(userAgent);
    return ["Samsung Browser", "Samsung Internet"].includes(parser.getBrowser()?.name);
}

export function isSmartphone(userAgent?: string): boolean {
    const parser = new UAParser(userAgent ?? navigator.userAgent);
    return parser.getDevice()?.type === "mobile";
}

export function isMobileOrTablet(userAgent?: string): boolean {
    const parser = new UAParser(userAgent ?? navigator.userAgent);
    return ["mobile", "tablet"].includes(parser.getDevice()?.type);
}

/*
** from https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#mobile_device_detection
*/
export function isTouchDevice(): boolean {
    if ("maxTouchPoints" in navigator) {
        return navigator.maxTouchPoints > 0;
    }
    if ("msMaxTouchPoints" in navigator) {
        return navigator["msMaxTouchPoints"] > 0;
    }
    const mQ = matchMedia?.("(pointer:coarse)");
    if (mQ?.media === "(pointer:coarse)") {
        return !!mQ.matches;
    }
    if ("orientation" in window) {
        return true; // deprecated, but good fallback
    }
    // Only as a last resort, fall back to user agent sniffing
    const UA = navigator["userAgent"];
    return /\b(BlackBerry|webOS|iPhone|IEMobile)\b/i.test(UA) || /\b(Android|Windows Phone|iPad|iPod)\b/i.test(UA);
}

export function isIPhone(userAgent?: string): boolean {
    const parser = new UAParser(userAgent);
    return parser.getDevice()?.model === "iPhone";
}

export function supportsNetworkInformationApi(): boolean {
    const nav = window?.navigator as { connection?: unknown; mozConnection?: unknown; webkitConnection?: unknown; };
    if (nav == null) return false;
    return nav.connection != null || nav.mozConnection != null || nav.webkitConnection != null;
}
