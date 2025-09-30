import { getClientIps, getClientIpsAsString, getIpsFromHeader } from "../../../src/util/ip";
import { WebRequest } from "../../../src/middleware/request";

describe("IP utils", () => {
    const createRequestMock = (headers: Record<string, string> = {}, ip = "") => ({
        header: (name: string) => headers[name.toLowerCase()],
        ip
    });

    describe("getIpsFromHeader", () => {
        it("should return normalized IPs without ports as comma-separated string", () => {
            const request = createRequestMock({
                "x-original-forwarded-for": "192.168.1.1:12345",
                "x-forwarded-for": "10.0.0.1:5678, 172.16.0.1:8080"
            });

            expect(getIpsFromHeader(request as WebRequest)).toBe("192.168.1.1,10.0.0.1,172.16.0.1");
        });

        it("should handle missing headers and return undefined", () => {
            expect(getIpsFromHeader(undefined)).toBe(undefined);
        });

        it("should trim spaces and remove ports", () => {
            const request = createRequestMock({
                "x-forwarded-for": " 203.0.113.195:5555 , 198.51.100.17:8888 "
            });

            expect(getIpsFromHeader(request as WebRequest)).toBe("203.0.113.195,198.51.100.17");
        });

        it("should correctly handle single IP without port", () => {
            const request = createRequestMock({
                "x-forwarded-for": "203.0.113.195"
            });

            expect(getIpsFromHeader(request as WebRequest)).toBe("203.0.113.195");
        });
    });

    describe("getClientIp", () => {
        it("should return all adressess from headers", () => {
            const request = createRequestMock({
                "x-forwarded-for": "203.0.113.195:1234, 198.51.100.17:5678"
            }, "10.1.1.1");

            expect(getClientIpsAsString(request as WebRequest)).toBe("203.0.113.195,198.51.100.17");
        });
    });

    describe("getClientIps", () => {
        it("should return all header IPs + request.ip, without ports", () => {
            const request = createRequestMock({
                "x-forwarded-for": "203.0.113.195:1234, 198.51.100.17:5678"
            }, "10.1.1.1:9999");

            expect(getClientIps(request as WebRequest)).toEqual([
                "203.0.113.195",
                "198.51.100.17",
                "10.1.1.1"
            ]);
        });

        it("should fallback to request.ip when headers missing", () => {
            const request = createRequestMock({}, "192.0.2.1:4000");

            expect(getClientIps(request as WebRequest)).toEqual(["192.0.2.1"]);
        });

        it("should handle empty headers and empty request.ip gracefully", () => {
            const request = createRequestMock({}, "");

            expect(getClientIps(request as WebRequest)).toEqual([]);
        });
    });
});
