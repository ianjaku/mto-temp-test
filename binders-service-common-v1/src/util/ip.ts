import { WebRequest } from "../middleware/request"


const FORWARDED_FOR_HEADER = "x-forwarded-for";
const ORIGINAL_FORWARDED_FOR_HEADER = "x-original-forwarded-for";


const normalizeHeader = (headerValue: string): string[] => {
    return headerValue
        .split(",")
        .map(ip => stripPort(ip.trim()))
        .filter(ip => !!ip);
};

const stripPort = (ip: string): string => {
    if (!ip) return undefined;
    const parts = ip.split(":");
    /*
    if ip address has exactly one : it probalby contains port added by Azure app gateway that we want to normalize
    if ip address has more colons it's probalby ipv6 address, it might require better parsing
    */
    return parts.length == 2 ? parts[0] : ip;
};

export const getClientIpsAsString = (request: WebRequest): string => {
    return getIpsFromHeader(request) || stripPort(request.ip)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getClientIpHeaders = (request) => {
    return {
        originalForwarded: request.header(ORIGINAL_FORWARDED_FOR_HEADER),
        forwarded: request.header(FORWARDED_FOR_HEADER)
    }
}

export const getIpsFromHeader = (request: WebRequest): string => {
    if (!request) {
        return undefined;
    }
    const { originalForwarded, forwarded } = getClientIpHeaders(request);
    const ips = [];

    if (originalForwarded) {
        ips.push(...normalizeHeader(originalForwarded));
    }
    if (forwarded) {
        ips.push(...normalizeHeader(forwarded));
    }

    return ips.join(",");
}

export const getClientIps = (request: WebRequest): string[] => {
    // Make sure we check all IPs in the x-forwarded-for header
    // As seen by Knauf, when they connect through a proxy
    // the x-forwarded-for header contains a comma-separated list of ips
    // request.ip is set to the last one in the list
    const forwardedHeader = getIpsFromHeader(request);
    const ipArray = forwardedHeader ?
        forwardedHeader.split(",").filter(ip => !!ip) :
        [];
    ipArray.push(stripPort(request.ip));
    return ipArray;
}
