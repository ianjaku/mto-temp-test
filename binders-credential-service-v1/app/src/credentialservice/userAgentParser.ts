import UAParser from "ua-parser-js";


interface IParseUAResult {
    deviceType: string,
    browserName: string,
    browserVersion: string,
    os: string,
    osVersion: string,
    mobileModel?: string,
}
export const parseUserAgent = (ua: string) : IParseUAResult => {
    const uaParser = new UAParser();
    uaParser.setUA(ua);
    const {
        device: { type: deviceType, model: deviceModel, vendor: deviceVendor },
        browser: { name: browser, version: browserVersion },
        os: { name: os, version: osVersion },
    } = uaParser.getResult();
    if(browser) {
        const mobileDesktop = deviceType || "desktop";
        return {
            deviceType: mobileDesktop,
            browserName: browser,
            browserVersion,
            os,
            osVersion,
            ...(deviceType==="mobile" ? {mobileModel: `${deviceVendor || ""} ${deviceModel || ""}`.trim()} : {})
        }
    }
    return undefined;
};