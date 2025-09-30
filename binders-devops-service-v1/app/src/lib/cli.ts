
function humanizeBytes(sizeInBytes: number): string {
    const exp = Math.floor(sizeInBytes === 0 ? 0 : Math.log(sizeInBytes) / Math.log(1024));
    const unit = ["B", "kB", "MB", "GB", "TB"][exp];
    const amount = sizeInBytes / Math.pow(1024, exp);
    return amount.toFixed(2) + " " + unit;
}

// Prints the memory usage to stdout

export function memusage(): void {
    const mem = process.memoryUsage();
    const report = [
        "Memory report",
        "===========================",
        `memory usage: rss: ${humanizeBytes(mem.rss)}`,
        `heap total: ${humanizeBytes(mem.heapTotal)}`,
        `heap used: ${humanizeBytes(mem.heapUsed)}`,
        `external: ${humanizeBytes(mem.external)}`
    ].join("\n")
    // eslint-disable-next-line no-console
    console.log(report);
}