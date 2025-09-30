export function humanizeBytes(sizeInBytes: number): string {
    const exp = Math.floor(sizeInBytes === 0 ? 0 : Math.log(sizeInBytes) / Math.log(1024));
    const unit = ["B", "kB", "MB", "GB", "TB"][exp];
    const amount = sizeInBytes / Math.pow(1024, exp);
    return amount.toFixed(2) + " " + unit;
}

export function humanizeDuration(milliseconds: number): string {
    if (milliseconds < 1000) return `${Math.round(milliseconds)}ms`;
    let seconds = milliseconds / 1000;
    if (seconds < 10) return `${seconds.toFixed(3)}s`;
    if (seconds < 60) return `${seconds.toFixed(2)}s`;
    let minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    seconds = Math.floor(seconds) % 60;
    minutes = Math.floor(minutes) % 60;
    return [
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
    ].join(":")
}

export function round(x: number, n: number): number {
    const exp = Math.pow(10, n);
    return Math.round(x * exp) / exp;
}
