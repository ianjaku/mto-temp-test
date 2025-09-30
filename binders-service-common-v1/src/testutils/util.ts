
export const sleepMs = async (timeMs: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, timeMs));
}

export const expectStatusCode = async <T>(
    statusCode: number,
    cb: () => Promise<T>
): Promise<T> => {
    try {
        const result = await cb();
        expect(200).toBe(statusCode);
        return result;
    } catch (e) {
        if ("statusCode" in e) {
            const receivedStatusCode = ensureNumber(e.statusCode);
            expect(receivedStatusCode).toBe(statusCode);
            return e;
        } else {
            throw e;
        }
    }
}

const ensureNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") return Number.parseInt(value);
    throw new Error(`Cannot parse ${value} to number`);
}


export type MockableService = "aicontent" | "mailer";

export const shouldServiceBeMocked = (service: MockableService): boolean => {
    const envVar = process.env.BINDERS_MOCK_SERVICES || "" ;
    return envVar
        .split(",")
        .map(s => s.trim())
        .includes(service);
}