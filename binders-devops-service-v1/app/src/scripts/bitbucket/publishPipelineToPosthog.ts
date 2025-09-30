import {
    InternalToolEvent,
    captureInternalToolEvent
} from "@binders/binders-service-common/lib/tracking/capture";
import { addHours, isAfter, isBefore, sub } from "date-fns";
import { getPipelineByBuildNumber, listPipelinesUntil } from "../../actions/bitbucket/api";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Command } from "commander";
import { getPipelineStatus } from "../../actions/bitbucket/pipelines";
import { info } from "@binders/client/lib/util/cli";
import { main } from "@binders/binders-service-common/lib/util/process";


const SCRIPT_NAME = "Publish pipeline results to Posthog";

const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("This script fetches bitbucket pipeline results and pushes them to Posthog")
    .option("-I --interval [interval]", "The interval with which this script is running (in hours)")
    .option("-B --build-number [buildNumber]", "Process a single build number");

type ScriptOptions = {
    interval?: number;
    buildNumber?: number;
};

function getOptions(): ScriptOptions {
    program.parse(process.argv);
    const opts = program.opts();
    return {
        interval: Number.parseInt(opts.interval, 10),
        buildNumber: Number.parseInt(opts.buildNumber, 10)
    }
}


const getBitbucketAccessToken = () => {
    if (process.env.BITBUCKET_ACCESS_TOKEN) {
        return process.env.BITBUCKET_ACCESS_TOKEN;
    }
    const config = BindersConfig.get();
    return config.getString("devops.bitbucket.accessToken").get();
}

function getPosthogPipeFailure(pipelineStatus, failure) {
    if (failure === "OTHER") {
        return {
            buildNumber: pipelineStatus.buildNumber,
            category: "OTHER",
        }
    }
    if (failure === "DEPLOY_FAILED") {
        return {
            buildNumber: pipelineStatus.buildNumber,
            category: "DEPLOY_FAILED",
        }
    }
    if (failure.timedOut && !failure.suite) {
        return {
            buildNumber: pipelineStatus.buildNumber,
            category: "TEST_FAILURE",
            suite: "TIMEOUT",
            ...failure
        }
    }
    return {
        buildNumber: pipelineStatus.buildNumber,
        category: "TEST_FAILURE",
        ...failure
    }
}

async function getPipelines(bitbucketAccessToken: string, options: ScriptOptions) {
    if (options.buildNumber && options.interval) {
        throw new Error("Cannot specify both build number and interval");
    }
    if (options.buildNumber) {
        const pipeline = await getPipelineByBuildNumber(bitbucketAccessToken, options.buildNumber);
        return [pipeline];
    } else {
        const { start, end } = getPipelineWindow(options);
        info(`Processing pipelines between ${start.toISOString()} and ${end.toISOString()}`);
        const pipelines = await listPipelinesUntil(bitbucketAccessToken, end, "asc");
        info(`Got ${pipelines.length} pipelines`);
        return pipelines.filter(pipeline => {
            const pipelineDate = new Date(pipeline.created_on);
            if (isAfter(pipelineDate, end) || isBefore(pipelineDate, start)) {
                info(`Skipping build number ${pipeline.build_number} as it is outside the window`);
                return false;
            }
            return true;
        });
    }
}

async function processPipelines() {
    const options = getOptions();
    const bitbucketAccessToken = await getBitbucketAccessToken();
    const pipelines = await getPipelines(bitbucketAccessToken, options);
    for (const pipeline of pipelines) {
        const buildNumber = pipeline.build_number;
        info(`Processing build number ${buildNumber}`);
        const pipelineStatus = await getPipelineStatus(bitbucketAccessToken, pipeline);
        if (pipelineStatus.status === "IN_PROGRESS") {
            info("Stop processing, found a pipeline that is still running");
            process.exit(0);
        }
        const pipelineResult = {
            buildNumber: pipelineStatus.buildNumber,
            status: pipelineStatus.status,
            durationInSeconds: pipelineStatus.durationInSeconds
        }
        for (const pipeFailure of pipelineStatus.failures) {
            const data = getPosthogPipeFailure(pipelineStatus, pipeFailure);
            await captureInternalToolEvent(
                InternalToolEvent.PipelineFailure,
                data as unknown as Record<string, unknown>,
                pipelineStatus.createdOn
            );
        }
        await captureInternalToolEvent(
            InternalToolEvent.PipelineResult,
            pipelineResult as unknown as Record<string, unknown>,
            pipelineStatus.createdOn,
        );
    }
}

const MAX_PIPELINE_DURATION_IN_MINUTES = 120;

function getPipelineWindow(options: ScriptOptions) {
    const { interval } = options;
    const now = new Date();

    if (interval) {
        const anchor = sub(now, { minutes: MAX_PIPELINE_DURATION_IN_MINUTES});
        anchor.setMinutes(0);
        anchor.setSeconds(0);
        anchor.setMilliseconds(0);
        const anchorHour = anchor.getHours();
        anchor.setHours(anchorHour - (anchorHour % interval));
        return {
            start: anchor,
            end: addHours(anchor, interval)
        }
    } else {
        return {
            start: new Date(0),
            end: now
        }
    }
}

main( async () => {
    await processPipelines();
});
