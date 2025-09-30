import fetch from "node-fetch";

const ONE_MINUTE = 60000;

class RateLimiter {

    private requestsTimestamps: number[];

    constructor(private maxRequestsPerMinute: number) {
        this.requestsTimestamps = [];
    }

    async fetch(url: fetch.RequestInfo, options: fetch.RequestInit): Promise<fetch.Response> {
        return this.run(() => fetch(url, options));
    }

    async run<E>(task: () => Promise<E>): Promise<E> {
        return new Promise((resolve, reject) => {
            const attempt = () => {
                const now = Date.now();
                // Keep only the timestamps within the last minute
                this.requestsTimestamps = this.requestsTimestamps.filter(timestamp => now - timestamp < ONE_MINUTE);

                if (this.requestsTimestamps.length < this.maxRequestsPerMinute) {
                    this.requestsTimestamps.push(now); // Add current request timestamp
                    task().then(resolve).catch(reject);
                } else {
                    // Calculate the time to wait until trying again, based on the oldest request in the last minute
                    const retryAfter = ONE_MINUTE - (now - this.requestsTimestamps[0]);
                    setTimeout(attempt, retryAfter);
                }
            };
            attempt();
        });
    }
}

export default RateLimiter;