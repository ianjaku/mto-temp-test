import {
    updateDomainInUrlData,
    urlDataNeedsDomainUpdate
} from "../../src/trackingservice/domainConverter";
import { IUserAccessedUrlData } from "@binders/client/lib/clients/trackingservice/v1/contract";

describe("urlDataNeedsDomainUpdate", () => {

    const oldDomain = "metsense";

    it("should return true when old domain is present in one of the fields", () => {
        const data: IUserAccessedUrlData = {
            host: "metsense.manual.to",
            url: "/home",
            referer: "https://example.com",
            domain: "metsense.manual.to",
            method: "GET",
            ips: []
        };
        expect(urlDataNeedsDomainUpdate(data, oldDomain)).toBe(true);
    });

    it("should return true when old domain is present as editor domain", () => {
        const data: IUserAccessedUrlData = {
            host: "example.manual.to",
            url: "/home",
            referer: "https://metsense.editor.manual.to",
            domain: "example.manual.to",
            method: "GET",
            ips: []
        };
        expect(urlDataNeedsDomainUpdate(data, oldDomain)).toBe(true);
    });


    it("should return false when old domain is not present", () => {
        const data: IUserAccessedUrlData = {
            host: "example.manual.to",
            url: "/home",
            referer: "https://example.com",
            domain: "example.manual.to",
            method: "GET",
            ips: []
        };
        expect(urlDataNeedsDomainUpdate(data, oldDomain)).toBe(false);
    });

    it("should return false when old domain is falsy value", () => {
        const data: IUserAccessedUrlData = {
            host: "example.manual.to",
            url: "/home",
            referer: "https://example.com",
            domain: "example.manual.to",
            method: "GET",
            ips: []
        };
        expect(urlDataNeedsDomainUpdate(data, undefined)).toBe(false);
    });
});



describe("updateDomainInUrlData", () => {
    const oldDomain = "metsense";
    const newDomain = "example";

    it("should replace old domain with new domain in all specified fields", () => {
        const data: IUserAccessedUrlData = {
            host: "metsense.manual.to",
            url: "/home",
            referer: "https://metsense.editor.manual.to",
            domain: "metsense.manual.to",
            hostname: "metsense.manual.to",
            method: "GET",
            search: "/?domain=metsense.manual.to",
            ips: []
        };
        const expected: IUserAccessedUrlData = {
            host: "example.manual.to",
            url: "/home",
            referer: "https://example.editor.manual.to",
            domain: "example.manual.to",
            hostname: "example.manual.to",
            search: "/?domain=example.manual.to",
            method: "GET",
            ips: []
        };
        expect(updateDomainInUrlData(data, oldDomain, newDomain)).toEqual(expected);
    });

    it("should handle undefined fields gracefully", () => {
        const data: IUserAccessedUrlData = {
            host: undefined,
            referer: undefined,
            url: undefined,
            domain: "metsense.manual.to",
            method: "GET",
            ips: ["127.0.0.1"],
        };
        const expected = {
            ...data,
            domain: "example.manual.to"
        };
        const result = updateDomainInUrlData(data, oldDomain, newDomain);
        expect(result).toEqual(expected);
    });

    it("should handle empty old domain string", () => {
        const data: IUserAccessedUrlData = {
            host: "metsense.manual.to",
            referer: "https://metsense.editor.manual.to",
            url: "/home",
            domain: "metsense.manual.to",
            method: "GET",
            ips: ["127.0.0.1"],
        };
        const expected: IUserAccessedUrlData = {
            ...data
        };
        const result = updateDomainInUrlData(data, "", newDomain);
        expect(result).toEqual(expected);
    });

    it("should handle empty new domain string", () => {
        const data: IUserAccessedUrlData = {
            host: "metsense.manual.to",
            referer: "https://metsense.editor.manual.to",
            url: "/home",
            domain: "metsense.manual.to",
            method: "GET",
            ips: ["127.0.0.1"],
        };
        const expected: IUserAccessedUrlData = {
            ...data
        };
        const result = updateDomainInUrlData(data, oldDomain, "");
        expect(result).toEqual(expected);
    });
});
