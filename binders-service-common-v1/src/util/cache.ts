const TEN_SECONDS_AS_MILLIS = 10_000;

/**
 * A mechanism to cache the provider response value and refresh it every 10 seconds by default.
 * If the provider fails, an error is logged. Initial value is `undefined`.
 * @param provider - a function that returns an awaitable value
 * @param providerErrorCallback - a callback invoked when the provider call fails
 * @param refreshInterval - milliseconds to refresh the value
 */
export async function createCachedProvider<T>(
    provider: () => Promise<T>,
    providerErrorCallback: (e: unknown) => void,
    refreshInterval = TEN_SECONDS_AS_MILLIS
): Promise<() => T | undefined> {
    let value: T = undefined;
    const setValue = async () => {
        try {
            value = await provider();
        } catch (e) {
            providerErrorCallback(e);
        }
    }
    await setValue();
    setInterval(setValue, refreshInterval);
    return () => value;
}