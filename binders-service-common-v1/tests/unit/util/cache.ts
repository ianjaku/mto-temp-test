/* eslint-disable no-console */
import { createCachedProvider } from "../../../src/util/cache";

describe("createCachedProvider", () => {
    jest.useFakeTimers();

    let originalConsoleError;
    const providerErrorCallback = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        originalConsoleError = console.error;
        console.error = jest.fn();
    });

    it("should return a function that retrieves the cached value", async () => {
        const mockProvider = jest.fn().mockResolvedValue("testValue");
        const cachedProvider = await createCachedProvider(mockProvider, providerErrorCallback);

        expect(cachedProvider()).toBe("testValue");
        expect(cachedProvider()).toBe("testValue");
        expect(cachedProvider()).toBe("testValue");
        expect(mockProvider).toHaveBeenCalledTimes(1);
        expect(providerErrorCallback).not.toHaveBeenCalled();
    });

    it("should update the cached value after the refresh interval", async () => {
        const mockProvider = jest.fn()
            .mockResolvedValueOnce("initialValue")
            .mockResolvedValueOnce("updatedValue");

        const cachedProvider = await createCachedProvider(mockProvider, providerErrorCallback, 1000);

        expect(cachedProvider()).toBe("initialValue");

        jest.advanceTimersByTime(1001);
        await Promise.resolve(); // Allow for the async provider to update the value

        expect(cachedProvider()).toBe("updatedValue");
        expect(mockProvider).toHaveBeenCalledTimes(2);
        expect(providerErrorCallback).not.toHaveBeenCalled();
    });

    it("should handle errors from the provider", async () => {
        const mockProvider = jest.fn().mockRejectedValue(new Error("Provider error"));
        const cachedProvider = await createCachedProvider(mockProvider, providerErrorCallback);

        expect(cachedProvider()).toBeUndefined();
        expect(mockProvider).toHaveBeenCalledTimes(1);
        expect(providerErrorCallback).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(10001);
        await Promise.resolve(); // Allow for the async provider to update the value

        expect(cachedProvider()).toBeUndefined();
        expect(providerErrorCallback).toHaveBeenCalledTimes(2);
    });

    afterEach(() => {
        jest.clearAllTimers();
        console.error = originalConsoleError;
    });
});