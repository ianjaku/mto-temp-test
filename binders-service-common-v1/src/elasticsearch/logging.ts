
let totalShards = 0;

export function logQueriedShards(extraShards: number): void {
    totalShards += extraShards;
    // eslint-disable-next-line no-console
    console.log(`>>>> ES Shards queried +${extraShards}: ${totalShards}`);
}