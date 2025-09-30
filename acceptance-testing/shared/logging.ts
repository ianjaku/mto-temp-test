import { dim } from "@binders/client/lib/util/cli";

export function log(message: string): void {
    // eslint-disable-next-line no-console
    process.stdout.write(dim(message));
}
