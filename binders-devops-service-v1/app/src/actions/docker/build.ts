import { BINDERS_SERVICE_SPECS, IServiceSpec, getServiceDir } from "../../config/services";
import { BuildBlueprint, BuildType, ServiceTask } from "../../lib/pipeline";
import { log } from "../../lib/logging";
import { runCommand } from "../../lib/commands";
import { toServiceName } from "../../lib/bindersenvironment";

export const DEVOPS_CONTEXT = "binders-devops-service-v1";
export const DEVOPS_DOCKER_CONTEXT = `${DEVOPS_CONTEXT}/app/docker`;
export const DEFAULT_BUILD_IMAGE_VERSION = "1.8.2021-1610097946";

const getServiceImageRepository = (name: string, version: string): string => {
    const spec = BINDERS_SERVICE_SPECS.find(s => (s.name === name && s.version === version));
    if (spec === undefined) {
        throw new Error(`Could not find spec for ${name}-${version}`);
    }
    const serviceDir = getServiceDir(spec);
    return `${ACR_NAME}/${serviceDir}`;
}

const getServiceImageTag = (name: string, version: string, activeServiceTags: Record<string, string>): string => {
    const tag = activeServiceTags[toServiceName({ name, version })]
    if (!tag) {
        throw new Error(`Missing tag for service ${name}-${version}`)
    }
    return `${getServiceImageRepository(name, version)}:${tag}`;
}

export const getCredentialServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("credential", "v1", activeServiceTags);
export const getDevopsDockerImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("devops", "v1", activeServiceTags);
export const getTrackingServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("tracking", "v1", activeServiceTags);
export const getImageServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("image", "v1", activeServiceTags);
export const getUserServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("user", "v1", activeServiceTags);
export const getBindersServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("binders", "v3", activeServiceTags)
export const getNotificationServiceTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("notification", "v1", activeServiceTags);
export const getAccountServiceImageTag = (activeServiceTags?: Record<string, string>): string => getServiceImageTag("account", "v1", activeServiceTags);

export const getStaticPagesRepository = (): string => getServiceImageRepository("static-pages", "v1");

export interface IBuildArgs {
    BUILD_IMAGE_VERSION: string;
    SHARED_BUILD_COMMIT: string;
    COMMON_REF: string;
    CLIENT_REF: string;
    UI_KIT_REF: string;
    BITBUCKET_COMMIT: string;
    BITBUCKET_BRANCH: string;
}

export interface ImageSpec {
    name: string;
    dockerFile: string;
    context: string;
    buildArgs?: Partial<IBuildArgs>;
}

export const IMAGE_UI_KIT: ImageSpec = {
    name: "binders-ui-kit",
    dockerFile: "Dockerfile.ui-kit",
    context: "binders-ui-kit",
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_FRONTEND_BUILD: ImageSpec = {
    name: "binders-frontend-build",
    dockerFile: "Dockerfile.frontend.build",
    context: DEVOPS_CONTEXT,
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_STATIC_PAGES: ImageSpec = {
    name: "binders-static-pages-service-v1",
    dockerFile: "Dockerfile",
    context: "binders-static-pages-service-v1"
};

export const IMAGE_API_BUILD: ImageSpec = {
    name: "binders-api-build",
    dockerFile: "Dockerfile.api.build",
    context: DEVOPS_CONTEXT,
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_COMMON: ImageSpec = {
    name: "binders-common",
    dockerFile: "Dockerfile.common",
    context: "binders-service-common-v1",
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_CLIENT: ImageSpec = {
    name: "binders-client",
    dockerFile: "Dockerfile.client",
    context: "binders-client-v1",
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_DEFAULT: ImageSpec = {
    name: "binders-service-default",
    dockerFile: "Dockerfile.default",
    context: DEVOPS_CONTEXT
};

export const IMAGE_BUILD: ImageSpec = {
    name: "binders-service-build",
    dockerFile: "Dockerfile.build",
    context: DEVOPS_CONTEXT
};

export const IMAGE_API_SERVICE: ImageSpec = {
    name: "binders-api-service",
    dockerFile: "Dockerfile.api.service",
    context: DEVOPS_DOCKER_CONTEXT,
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_FRONTEND_SERVICE: ImageSpec = {
    name: "binders-api-service",
    dockerFile: "Dockerfile.frontend.service",
    context: DEVOPS_DOCKER_CONTEXT,
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const IMAGE_DEVOPS_SERVICE: ImageSpec = {
    name: "binders-devops-service-v1",
    dockerFile: "Dockerfile.devops",
    context: "binders-devops-service-v1",
    buildArgs: {
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    }
};

export const buildImage = async (tag: string, dockerFile: string, buildContext: string,
    buildArgs: { [key: string]: string } = {}): Promise<void> => {
    const args = Object.keys(buildArgs)
        .reduce((reduced, buildArg) => {
            return reduced.concat(["--build-arg", `${buildArg}=${buildArgs[buildArg]}`]);
        }, []);
    const dockerArgs = ["build", "-t", tag, /* "--no-cache" , */ "-f", dockerFile, buildContext, ...args];
    log(`Running 'docker ${dockerArgs.join(" ")}`);
    await runCommand("docker", dockerArgs);
};

export const pushImage = async (tag: string): Promise<void> => {
    await runCommand(
        "docker",
        ["push", tag]
    );
};

export const pullImage = async (tag: string): Promise<void> => {
    await runCommand(
        "docker",
        ["pull", tag]
    );
};

export const tagImage = async (existingTag: string, newTag: string): Promise<void> => {
    const { output } = await runCommand(
        "docker",
        ["images", existingTag, "--format", "\"{{.ID}}\""]
    );
    if (output.trim() === "") {
        await runCommand(
            "docker",
            ["pull", existingTag]
        );
    }
    log(`Retagging '${existingTag}' to '${newTag}'`);
    await runCommand(
        "docker",
        ["tag", existingTag, newTag]
    );
};


export const ACR_NAME = "binders.azurecr.io";
const dockerDevImagePrefix = `${ACR_NAME}/local-dev-`;

export const toRemoteDevImageTag = (localTag: string): string => `${dockerDevImagePrefix}${localTag}`;

export const getCommitTag = (imageName: string, commitRef: string): string => `${ACR_NAME}/${imageName}:${commitRef}`;


export const buildDockerImage = async (
    blueprint: BuildBlueprint, plan: ServiceTask,
    imageSpec: ImageSpec, buildArgs: Partial<IBuildArgs> = {}): Promise<void> => {

    const { currentCommitRef } = blueprint;
    const newCommitTag = getCommitTag(imageSpec.name, currentCommitRef);
    if (plan.buildType === BuildType.SKIP) {
        log("Skipping build");
        return;
    }

    await buildImage(
        newCommitTag,
        imageSpec.dockerFile,
        imageSpec.context,
        { ...(imageSpec.buildArgs || {}), ...buildArgs }
    );
    if (process.env.BINDERS_BUILD_TEST === "1") {
        const headTag = getCommitTag(imageSpec.name, "HEAD")
        log(`Skipping push, tagging as ${headTag}`);
        await tagImage(newCommitTag, headTag);
        return;
    }
    const branchCommitTag = getCommitTag(imageSpec.name, blueprint.currentBranch);
    await tagImage(newCommitTag, branchCommitTag);
    await pushImage(newCommitTag);
    await pushImage(branchCommitTag);
};

export const getNonSharedServiceSpecForDirectory = (serviceDirectory: string): IServiceSpec => {
    const specs = BINDERS_SERVICE_SPECS
        .filter(spec => !spec.sharedDeployment)
        .filter(spec => serviceDirectory === getServiceDir(spec));
    if (specs.length > 2) {
        throw new Error(`Found multiple specs for ${serviceDirectory}`);
    }
    return specs[0];
}

export const getBuildType = (serviceDirectory: string, changedFiles: string[], changedDependants: string[]): BuildType => {
    const didServiceFilesChange = serviceFilesHaveChanged(serviceDirectory, changedFiles);
    const didStaticSitesChange = staticSitesHaveChanged(serviceDirectory, changedFiles);
    const dependantsCheck = changedDependants.includes(serviceDirectory);
    const shouldRebuild = dependantsCheck || didServiceFilesChange || didStaticSitesChange;
    return shouldRebuild ? BuildType.FULL : BuildType.SKIP;
}

const serviceFilesHaveChanged = (serviceDirectory: string, changedFiles: string[]): boolean => {
    return changedFiles.some(file => {
        const [topDir] = file.split("/");
        return topDir === serviceDirectory;
    });
}

const staticSitesHaveChanged = (serviceDirectory: string, changedFiles: string[]): boolean => {
    const staticSiteConfigChange = changedFiles.includes(
        "binders-devops-service-v1/app/src/lib/staticsites.ts"
    );
    const isStaticSiteService = serviceDirectory === "binders-static-pages-service-v1";
    return staticSiteConfigChange && isStaticSiteService;
}
