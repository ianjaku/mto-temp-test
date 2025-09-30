/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as fs from "fs";
import * as path from "path";
import { assertNoUncommitted, getCurrentCommitRef } from "../actions/git/commits";
import { getCurrentBranch } from "../actions/git/branches";
import { getLocalRepositoryRoot } from "../actions/git/local";
import { loadJSON } from "./json";

export const TEMPORARY_SERVICE_EXCLUSION_LIST = [
    // "binders-devops-service-v1",
    "binders-editor-service-v1"
];

export const enum BuildPhases {
    SHARED      = 100,
    SERVICES    = 1000
}

export enum BuildType {
    SKIP,
    FULL
}

export const BUILD_SLOTS_SERVICE = 5;

export interface ServiceTask {
    phase: BuildPhases;
    buildType: BuildType;
    slot?: number;
}

export interface BuildPlan {
    [serviceDirectory: string]: ServiceTask;
}

export interface BuildBlueprint {
    currentBranch: string;
    currentCommitRef: string;
    lastBuiltBranch: string;
    lastBuiltCommitRef: string;
    plan: BuildPlan;
}

export const getArtifactDir = async () => {
    return "/artifacts";
};

export const getBuildPlanFile = async () => {
    const basePath = "binders-devops-service-v1/app/buildplan.json";
    try {
        const repoRoot = await getLocalRepositoryRoot();
        const fullPath = `${repoRoot}/${basePath}`;
        if (fs.existsSync(path.dirname(fullPath))) {
            return fullPath;
        }
        return basePath;
    } catch (err) {
        return basePath;
    }
};

export const getBuildBlueprint = async (): Promise<BuildBlueprint> => {
    const buildPlanFile = await getBuildPlanFile();
    return {
        ...(await loadJSON(buildPlanFile))
    } as BuildBlueprint;
};

export const getLocalBuildBlueprint = async (serviceFolder: string): Promise<BuildBlueprint> => {
    const currentBranch = await getCurrentBranch();
    const plan = {
        [serviceFolder]: {
            phase: BuildPhases.SERVICES,
            buildType: BuildType.FULL
        }
    }
    await assertNoUncommitted();
    const currentCommitRef = await getCurrentCommitRef();
    return {
        currentBranch,
        currentCommitRef,
        lastBuiltBranch: currentBranch,
        lastBuiltCommitRef: "FAKE",
        plan
    }
}