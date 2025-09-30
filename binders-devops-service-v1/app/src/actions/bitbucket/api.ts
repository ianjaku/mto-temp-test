import * as bb from "bitbucket";
import fetch from "node-fetch";
import { isAfter } from "date-fns";

export const REPO_SLUG = "manualto";
export const WORKSPACE = "bindersmedia";
const MAX_PAGES_TO_FETCH = 100;


function getClientOptions(token) {
    return {
        auth: {
            token: token || process.env.BITBUCKET_ACCESS_TOKEN,
        },
        baseUrl: "https://api.bitbucket.org/2.0",
    };
}

let apiClient;
function getApiClient(token: string): bb.APIClient {
    if(!apiClient) {
        apiClient = new bb.Bitbucket(getClientOptions(token));

    }
    return apiClient;
}

export type SortOrder = "asc" | "desc";
export async function listPipelinesUntil(token: string, cutoffDate: Date, order: SortOrder = "desc"): Promise<bb.Schema.Pipeline[]> {
    const apiClient = getApiClient(token);
    let page = 1;
    const pipelines = [];
    const sort = order === "desc" ? "-created_on" : "created_on";
    const isValid = order === "desc" ?
        (date: Date) => isAfter(date, cutoffDate) :
        (date: Date) => !isAfter(date, cutoffDate);
    do {
        const pipelinesListParams = {
            repo_slug: REPO_SLUG,
            workspace: WORKSPACE,
            sort,
            page: page.toString(),
            pagelen: 100
        };
        const pipelinesResponse = await apiClient.pipelines.list(pipelinesListParams);
        const bbPipelines = pipelinesResponse.data.values;
        if (bbPipelines.length === 0) {
            return pipelines;
        }
        for (const pipeline of bbPipelines) {
            if (isValid(new Date(pipeline.created_on))) {
                pipelines.push(pipeline);
            } else {
                return pipelines;
            }
        }
        page++;
    } while (page < MAX_PAGES_TO_FETCH);
    return pipelines;
}

export async function getPipelineByBuildNumber(token: string, buildNumber: number): Promise<bb.Schema.Pipeline> {
    const apiClient = getApiClient(token);
    let page = 0;
    let pipeline;
    do {
        const pipelinesListParams = {
            repo_slug: REPO_SLUG,
            workspace: WORKSPACE,
            sort: "-created_on",
            page: page.toString(),
        };
        const pipelinesResponse = await apiClient.pipelines.list(pipelinesListParams);
        if (pipelinesResponse.data.values.length === 0) {
            throw new Error(`Pipeline with build number ${buildNumber} not found`);
        }
        pipeline = pipelinesResponse.data.values.find(
            pipeline => pipeline.build_number === buildNumber
        );
        page++;
    } while (pipeline === undefined);
    return pipeline;
}


export async function getTestCases(token: string, step) {
    const apiClient = getApiClient(token);
    const testReportParams = {
        repo_slug: REPO_SLUG,
        workspace: WORKSPACE,
        pipeline_uuid: step.pipeline.uuid,
        step_uuid: step.uuid
    };
    const testCasesResponse = await apiClient.pipelines.getPipelineTestReportTestCases(testReportParams);
    return testCasesResponse.data.values;
}



export async function getStepLogs(token: string, step) {
    const apiClient = getApiClient(token);
    const stepLogParams = {
        repo_slug: REPO_SLUG,
        workspace: WORKSPACE,
        pipeline_uuid: step.pipeline.uuid,
        step_uuid: step.uuid,
    }
    const stepLogResponse = await apiClient.pipelines.getStepLog(stepLogParams);
    const logResponse = await fetch(stepLogResponse.url);
    return logResponse.text();
}

export async function getFailedSteps(token: string, pipeline) {
    const apiClient = getApiClient(token);
    const stepListParams = {
        pipeline_uuid: pipeline.uuid,
        repo_slug: REPO_SLUG,
        workspace: WORKSPACE,
        pagelen: 200,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stepsResponse = await apiClient.pipelines.listSteps(stepListParams) as any;
    return stepsResponse.data.values.filter(step => step.state.result?.name === "FAILED");
}

export async function createPullRequest(token: string, sourceBranch: string, targetBranch: string): Promise<void> {
    const apiClient = getApiClient(token);
    const prParams = {
        repo_slug: REPO_SLUG,
        workspace: WORKSPACE,
        title: `Merge ${sourceBranch} into ${targetBranch}`,
        source: {
            branch: {
                name: sourceBranch
            }
        },
        destination: {
            branch: {
                name: targetBranch
            }
        }
    }
    await apiClient.pullrequests.create(prParams);
}