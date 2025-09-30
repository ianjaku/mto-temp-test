import { log } from "./logging";

export async function main (body: () => Promise<void>): Promise<void> {
    try {
        await body();
        log("All done!");
        process.exit(0);
    } catch (error) {
        log("!!! Something went wrong.");
        // eslint-disable-next-line no-console
        console.error(error);
        process.exit(1);
    }
}