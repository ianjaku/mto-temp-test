import { mock } from "jest-mock-extended";

export function mockWithFailure<T>(mockName?: string) {
    return mock<T>({} as never, {
        fallbackMockImplementation: (...params: unknown[]) => {
            throw new Error(`${mockName ? `[${mockName}] ` : ""}Called method was not mocked when called with: ` + JSON.stringify(params, null, 2));
        }
    });
}