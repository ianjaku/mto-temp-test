

export function sequential<A> (f: (input: A) => Promise<void>, input: A[]): Promise<void> {
    return input.reduce(
        async (_, inputElement) => {
            await _;
            await f(inputElement);
        },
        Promise.resolve()
    );
}

export const sleep = (durationInMs: number): Promise<unknown> => {
    return new Promise (resolve => {
        setTimeout(resolve, durationInMs);
    });
};