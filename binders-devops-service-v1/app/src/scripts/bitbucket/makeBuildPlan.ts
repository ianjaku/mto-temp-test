import * as fs from "fs";
import {
    BUILD_SLOTS_SERVICE,
    BuildBlueprint,
    BuildPhases,
    BuildPlan,
    BuildType,
    ServiceTask,
    TEMPORARY_SERVICE_EXCLUSION_LIST,
    getBuildPlanFile
} from "../../lib/pipeline";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    IMAGE_API_BUILD,
    IMAGE_CLIENT,
    IMAGE_COMMON,
    IMAGE_FRONTEND_BUILD,
    IMAGE_UI_KIT,
    getBuildType
} from "../../actions/docker/build";
import { findMostRecentTag, regexForBranch } from "../../actions/git/tags";
import { shortenBranchName, shortenCommitRef } from "../../lib/k8s";
import { dumpJSON } from "../../lib/json";
import { getChangedDependants } from "../../actions/build/deps";
import { getChangedFiles } from "../../actions/git/commits";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { isReleaseBranch } from "../../lib/secrets";
import { isRunningPRPipeline } from "../../lib/bitbucket";
import { listDirectory } from "../../lib/fs";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

class NoIncrementalBuildError extends Error {
    constructor() {
        super("No incremental build possible");
    }
}

const getChangedFilesSinceLastBuild = async (branch: string, targetCommit: string) => {
    const lastBranchTag = await findMostRecentTag(regexForBranch(branch));
    if (lastBranchTag === undefined) {
        log(`No tag found for branch ${branch}`);
        throw new NoIncrementalBuildError();
    }
    const refFromTag = lastBranchTag
        .substring(branch.length + 1)
        // temp replace of leading and trailing '-', after fix to shortenbranchName this can no longer happen
        .replace(/(^-+)|(-+$)/g, "");

    // Check if we have a full- tag, if so pick an old ref forcing a full rebuild
    if (refFromTag.startsWith("full-")) {
        throw new NoIncrementalBuildError();
    }
    const commitRef = refFromTag;
    log(`Diffing between commit ref ${commitRef} and ${targetCommit}`);
    try {
        const changedFiles = await getChangedFiles(commitRef, targetCommit)
        return {
            lastBuiltBranch: branch,
            lastBuiltCommitRef: commitRef,
            changedFiles
        };
    } catch (exception) {
        throw new NoIncrementalBuildError();
    }
};


const completeServiceBuildSlots = (buildPlan: BuildPlan, serviceSlot: number) => {
    for (const serviceDir in buildPlan) {
        const serviceTask = buildPlan[serviceDir];
        if (serviceTask.buildType === BuildType.SKIP) {
            serviceSlot = (serviceSlot + 1) % BUILD_SLOTS_SERVICE;
            serviceTask.slot = serviceSlot;
        }
    }

    const dependantPlans = [IMAGE_UI_KIT, IMAGE_CLIENT, IMAGE_COMMON].map(
        imageSpec => buildPlan[imageSpec.context]
    );
    const serviceBuildImageBuildType = dependantPlans.reduce(
        (reduced, plan) => (reduced === BuildType.FULL ? reduced : plan.buildType),
        BuildType.SKIP
    );
    const serviceBuildImagePlan: ServiceTask = {
        buildType: serviceBuildImageBuildType,
        phase: BuildPhases.SHARED
    };
    buildPlan[IMAGE_API_BUILD.name] = serviceBuildImagePlan;
    buildPlan[IMAGE_FRONTEND_BUILD.name] = serviceBuildImagePlan;
};

async function getFoldersToPlan(repoRoot: string): Promise<string[]> {
    const blackList = [
        ".git",
        ".yarn",
        "acceptance-testing",
        "artifacts",
        "binders-homepage-service-v1",
        "buildtools",
        "devops",
        "docs",
        "internal-tools",
        "manualto-homepage-service-v1",
        "npm-private-repository-v1",
        "private-docker-registry-v1",
        "staging",
        "telltree-homepage-service-v1",
        "test",
        ...TEMPORARY_SERVICE_EXCLUSION_LIST
    ];
    const entries = await listDirectory(repoRoot);
    return entries.filter(change => blackList.indexOf(change) === -1);
}

async function dumpBuildBluePrint(
    getBuildType: (entry: string) => BuildType,
    currentBranch: string,
    currentCommitRef: string,
    lastBuiltBranch: string,
    lastBuiltCommitRef: string
): Promise<void> {
    const repoRoot = await getLocalRepositoryRoot();
    const toPlan = await getFoldersToPlan(repoRoot);
    const sharedBuildItems = [
        "binders-client-v1",
        "binders-service-common-v1",
        "binders-ui-kit"
    ];
    const buildPlan: BuildPlan = {};
    let serviceSlot = BUILD_SLOTS_SERVICE - 1;
    toPlan.forEach( entry => {
        if (!fs.lstatSync(`${repoRoot}/${entry}`).isDirectory()) {
            return;
        }
        const buildType = getBuildType(entry);
        if (sharedBuildItems.indexOf(entry) > -1) {
            log(`${entry} shared ${BuildType[buildType]}`);
            buildPlan[entry] = {
                phase: BuildPhases.SHARED,
                buildType
            };
            return;
        }
        log(`${entry} service ${BuildType[buildType]}`);

        buildPlan[entry] = {
            phase: BuildPhases.SERVICES,
            buildType
        };
        if (buildType === BuildType.FULL) {
            serviceSlot = (serviceSlot + 1) % BUILD_SLOTS_SERVICE;
            buildPlan[entry].slot = serviceSlot;
        }
    });
    completeServiceBuildSlots(buildPlan, serviceSlot);
    const buildPlanFile = await getBuildPlanFile();
    log(`Dumping build plan to ${buildPlanFile}`);
    const buildBluePrint: BuildBlueprint = {
        plan: buildPlan,
        currentBranch,
        currentCommitRef,
        lastBuiltBranch,
        lastBuiltCommitRef
    };
    await dumpJSON(buildBluePrint, buildPlanFile);
}

const makeIncrementalBuildPlan = async (changedFiles: string[], lastBuiltBranch: string, lastBuiltCommitRef: string, currentBranch: string, currentCommitRef: string) => {
    const changedDependants = await getChangedDependants(changedFiles);
    const getBuildTypeCB = (entry: string) => getBuildType(entry, changedFiles, changedDependants);
    await dumpBuildBluePrint(getBuildTypeCB, currentBranch, currentCommitRef, lastBuiltBranch, lastBuiltCommitRef);
};

type Options = {
    branch: string;
    commit: string;
};
const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to build",
            kind: OptionType.STRING,
            required: true
        },
        commit: {
            long: "commit",
            short: "c",
            description: "The current git commit",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("makeBuildPlan", programDefinition);
    const options = parser.parse<Options>();
    options.branch = shortenBranchName(options.branch);
    options.commit = shortenCommitRef(options.commit);
    return options;
};

async function makeFullBuildPlan(branch: string, commitRef: string): Promise<void> {
    await dumpBuildBluePrint(() => BuildType.FULL, branch, commitRef, branch, commitRef);
}

main(async () => {
    const { commit, branch } = getOptions();
    if (isReleaseBranch(branch) && isRunningPRPipeline()) {
        // We will fail the PR pipeline otherwise we might be pushing images to ACR
        // with a conflicting tag. The commit ref is not representative of the
        // code base state as the target PR branch is merged in when starting the pipeline
        log("Failing pipeline, running PR pipeline on release branch");
        process.exit(1);
    }
    try {
        const { changedFiles, lastBuiltBranch, lastBuiltCommitRef } = await getChangedFilesSinceLastBuild(branch, commit);
        await makeIncrementalBuildPlan(changedFiles, lastBuiltBranch, lastBuiltCommitRef, branch, commit);
    } catch (exception) {
        if (exception instanceof NoIncrementalBuildError) {
            log("Falling back to full build plan");
            await makeFullBuildPlan(branch, commit);
        } else {
            throw exception;
        }
    }
});