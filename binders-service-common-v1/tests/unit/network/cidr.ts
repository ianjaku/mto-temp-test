import { MultiCIDR } from "../../../src/network/cidr";

describe("cidr", () => {
    it("should return false if there are no ranges", () => {
        const cidr = new MultiCIDR([]);
        expect(cidr.contains("127.0.0.1")).toEqual(false);
    });

    it("should validate the input cidrs", () => {
        expect(() => new MultiCIDR(["abc"])).toThrow();
        expect(() => new MultiCIDR([undefined])).toThrow();
    });

    it("should check ips correctly (single cidr)", () => {
        const cidr = new MultiCIDR(["183.123.12.0/24"]);
        expect(cidr.contains("183.123.12.0")).toEqual(true);
        expect(cidr.contains("183.123.12.12")).toEqual(true);
        expect(cidr.contains("183.123.12.255")).toEqual(true);
        expect(cidr.contains("183.123.11.255")).toEqual(false);
        expect(cidr.contains("183.123.13.0")).toEqual(false);
        expect(cidr.contains("132.12.4.1")).toEqual(false);
        expect(cidr.contains("211.123.12.0")).toEqual(false);
    });

    it("should check ips correctly (mutliple cidrs)", () => {
        const cidr = new MultiCIDR(["183.123.12.0/24", "132.12.4.1/16" ]);
        expect(cidr.contains("183.123.12.0")).toEqual(true);
        expect(cidr.contains("183.123.12.12")).toEqual(true);
        expect(cidr.contains("183.123.12.255")).toEqual(true);
        expect(cidr.contains("183.123.11.255")).toEqual(false);
        expect(cidr.contains("183.123.13.0")).toEqual(false);
        expect(cidr.contains("132.12.4.1")).toEqual(true);
        expect(cidr.contains("211.123.12.0")).toEqual(false);
    });
});


