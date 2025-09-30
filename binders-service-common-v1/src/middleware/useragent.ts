import * as UAParser from "ua-parser-js";

type ParsedUserAgentInfo = {
    deviceType: string,
    browser: string,
    major: string,
    minor: string,
    patch: string,
    os: string,
    device: string,
};

export const parseUserAgent = (ua: string): ParsedUserAgentInfo => {
    const uaParser = new UAParser();
    uaParser.setUA(ua);
    const useragent = uaParser.getResult();

    const versionNs = useragent.browser.version?.split(".") || [];
    const deviceType = useragent.device?.type || undefined;
    const browser = useragent.browser?.name;
    const major = versionNs.length >= 1 && versionNs[0] || undefined;
    const minor = versionNs.length >= 2 && versionNs[1] || undefined;
    const patches = versionNs.length >= 3 && versionNs.slice(2) || undefined;
    const patch = patches?.join(".") || undefined;
    const osString = `${useragent.os?.name || ""} ${useragent.os?.version || ""}`.trim() || undefined;
    const device = `${useragent.device?.vendor || ""} ${useragent.device?.model || ""}`.trim() || undefined;

    return {
        deviceType,
        browser,
        major,
        minor,
        patch,
        os: osString,
        device
    };
};