import UAParser from "ua-parser-js";

let _isIe: boolean;
export function isIE(): boolean {
    if (_isIe === undefined) {
        _isIe = navigator.appName === "Microsoft Internet Explorer" ||
        !!(navigator.userAgent.match(/Trident/)) ||
        (typeof window["browser"] !== "undefined" && window["browser"]["msie"] === 1);
    }
    return _isIe;
}

export function isSafari(): boolean {
    const ua = window.navigator.userAgent;
    return !!/^((?!chrome|android).)*safari/i.test(ua);
}

// @deprecated, there's a better way to check for mobile safari in util/browsers (isMobileSafari)
export function isIOSSafari(): boolean {
    const ua = window.navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    return iOS && isSafari();
}

export const isMobileDevice = (): boolean => {
    const uaParser = new UAParser();
    const { type } = uaParser.getDevice();
    return type === "mobile" || type === "tablet";
}