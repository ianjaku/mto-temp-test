import { Job, Worker, WorkerOptions, } from "bullmq";
import { BindersConfig } from "../bindersconfig/binders";
import { LoggerBuilder } from "../util/logging";
import { buildConnection } from "./connection";

type Handler<TPayload, TResult> = (job: Job<TPayload>) => Promise<TResult>;

export interface WorkerBootstrapOpts
    extends Pick<WorkerOptions, "concurrency" | "lockDuration"> {
}


const buildCategory = (queueName: string) => `${queueName}-worker`

/**
 * Bootstraps a single BullMQ worker **inside its own Docker container**.
 *
 * @returns the Worker instance (mostly for tests).
 */
export function bootstrapWorker<TPayload, TResult = unknown>(
    queueName: string,
    handler: Handler<TPayload, TResult>,
    opts: WorkerBootstrapOpts = {}
) {
    const cfg = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(cfg);
    const connection = buildConnection(cfg)

    const worker = new Worker<TPayload, TResult>(queueName, handler, {
        connection,
        concurrency: opts.concurrency ?? 2,
        lockDuration: opts.lockDuration ?? 120_000,
    });

    const category = buildCategory(queueName)
    worker
        .on("completed", (job, rv) =>
            logger.info(`✅ ${queueName}:${job.id} done →`, category, rv),
        )
        .on("failed", (job, err) =>
            logger.error(`❌ ${queueName}:${job?.id} failed →`, category, err?.message),
        );


    let isShuttingDown = false;
    const gracefulShutdown = async () => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        logger.info("SIGTERM received, closing worker…", queueName);
        try {
            await worker.close();
            process.exit(0);
        } catch (error) {
            logger.error("Error during graceful shutdown", category, error);
            process.exit(1);
        }
    };
    process.once("SIGTERM", gracefulShutdown);
    process.once("SIGINT", gracefulShutdown);

    return worker;
}
