import { BindersConfig } from "../../../src/bindersconfig/binders";
import { RedisServerConfig } from "../../../src/redis/client";
import { buildConnection } from "../../../src/bullmq/connection";

describe("buildConnection", () => {
    function createMockConfig(redisConfig: RedisServerConfig): BindersConfig {
        return {
            getObject: jest.fn().mockReturnValue({
                get: () => redisConfig
            })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
    }

    it("should return standalone connection config when useSentinel is false", () => {
        const mockConfig = createMockConfig({
            useSentinel: false,
            host: "localhost",
            port: 6379
        });

        const result = buildConnection(mockConfig);

        expect(result).toEqual({
            host: "localhost",
            port: 6379
        });
    });

    it("should return sentinel connection config when useSentinel is true", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379,
            sentinels: [
                { host: "sentinel1", port: 26379 },
                { host: "sentinel2", port: 26379 }
            ]
        });

        const result = buildConnection(mockConfig);

        expect(result).toEqual({
            sentinels: [
                { host: "sentinel1", port: 26379 },
                { host: "sentinel2", port: 26379 }
            ],
            name: "mymaster"
        });
    });

    it("should throw error when standalone connection is missing host", () => {
        const mockConfig = createMockConfig({
            useSentinel: false,
            host: "",
            port: 6379
        });

        expect(() => buildConnection(mockConfig)).toThrow("Redis configuration missing required host or port");
    });

    it("should throw error when standalone connection is missing port", () => {
        const mockConfig = createMockConfig({
            useSentinel: false,
            host: "localhost",
            port: 0
        });

        expect(() => buildConnection(mockConfig)).toThrow("Redis configuration missing required host or port");
    });

    it("should throw error when sentinel configuration is missing sentinels array", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379
        });

        expect(() => buildConnection(mockConfig)).toThrow("Sentinel configuration missing sentinels array");
    });

    it("should throw error when sentinel configuration has empty sentinels array", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379,
            sentinels: []
        });

        expect(() => buildConnection(mockConfig)).toThrow("Sentinel configuration missing sentinels array");
    });

    it("should throw error when sentinel is missing host", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379,
            sentinels: [
                { host: "", port: 26379 }
            ]
        });

        expect(() => buildConnection(mockConfig)).toThrow("Sentinel configuration missing host or port for sentinel");
    });

    it("should throw error when sentinel is missing port", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379,
            sentinels: [
                { host: "sentinel1", port: 0 }
            ]
        });

        expect(() => buildConnection(mockConfig)).toThrow("Sentinel configuration missing host or port for sentinel");
    });

    it("should throw error when one of multiple sentinels is invalid", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "localhost",
            port: 6379,
            sentinels: [
                { host: "sentinel1", port: 26379 },
                { host: "sentinel2", port: 0 }
            ]
        });

        expect(() => buildConnection(mockConfig)).toThrow("Sentinel configuration missing host or port for sentinel");
    });

    it("should not validate host/port for sentinel configuration", () => {
        const mockConfig = createMockConfig({
            useSentinel: true,
            host: "",
            port: 0,
            sentinels: [
                { host: "sentinel1", port: 26379 }
            ]
        });

        const result = buildConnection(mockConfig);

        expect(result).toEqual({
            sentinels: [
                { host: "sentinel1", port: 26379 }
            ],
            name: "mymaster"
        });
    });
});