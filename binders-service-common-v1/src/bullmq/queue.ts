
import { ConnectionOptions, JobsOptions, Queue, QueueEvents, QueueOptions } from "bullmq";
import type { BindersConfig } from "../bindersconfig/binders";
import type { Logger } from "../util/logging";
import { buildConnection } from "./connection";


const DEFAULT_JOB_OPTS: JobsOptions = {
    attempts: 2,
    backoff: { type: "exponential", delay: 3_000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
};
const DEFAULT_TIMEOUT = 300_000; // 5 min

export const SCREENSHOT_QUEUE = "screenshot-queue"

export interface QueueClient<TPayload, TResult = unknown> {
    add(jobName: string, data: TPayload, opts?: JobsOptions): Promise<TResult>;
    close(): Promise<void>;
}

export class QueueFactory {
    private readonly connection: ConnectionOptions
    private readonly logger: Logger;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly cache = new Map<string, QueueClientImpl<any, any>>();

    constructor(cfg: BindersConfig, logger: Logger) {
        this.connection = buildConnection(cfg)
        this.logger = logger;
    }

    getQueue<TPayload, TResult = unknown>(
        queueName: string,
        opts: Partial<QueueOptions> = {}
    ): QueueClient<TPayload, TResult> {
        if (!this.cache.has(queueName)) {
            const q = new Queue(queueName, { connection: this.connection, defaultJobOptions: DEFAULT_JOB_OPTS, ...opts });
            const events = new QueueEvents(queueName, { connection: this.connection });
            this.cache.set(
                queueName,
                new QueueClientImpl<TPayload, TResult>(
                    queueName,
                    q,
                    events,
                    this.logger
                )
            );
        }
        return this.cache.get(queueName)!;
    }

    async closeAll() {
        await Promise.all(
            [...this.cache.values()].map((client) => client.close())
        );
        this.cache.clear();
    }
}


class QueueClientImpl<TPayload, TResult> implements QueueClient<TPayload, TResult> {
    constructor(
        private readonly queueName: string,
        private readonly q: Queue,
        private readonly events: QueueEvents,
        private readonly logger: Logger
    ) { }

    async add(
        jobName: string,
        data: TPayload
    ): Promise<TResult> {
        const job = await this.q.add(jobName, data);
        this.logger.info(
            `Scheduled job ${job.id} on queue ${this.queueName}`,
            this.queueName
        );

        return new Promise<TResult>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error(`Job ${job.id} timed out after ${DEFAULT_TIMEOUT}ms`));
            }, DEFAULT_TIMEOUT);

            const onDone = ({ jobId, returnvalue }) => {
                if (jobId === job.id) {
                    cleanup();
                    resolve(returnvalue as TResult);
                }
            };

            const onFail = ({ jobId, failedReason }) => {
                if (jobId === job.id) {
                    cleanup();
                    this.logger.error(
                        `Job ${job.id} failed on queue ${this.queueName}`,
                        this.queueName,
                        failedReason
                    );
                    reject(new Error(failedReason));
                }
            };

            const cleanup = () => {
                this.events.off("completed", onDone);
                this.events.off("failed", onFail);
                clearTimeout(timeoutId);
            };

            this.events.on("completed", onDone);
            this.events.on("failed", onFail);
        });
    }

    async close() {
        await this.q.close();
        await this.events.close();
    }
}
