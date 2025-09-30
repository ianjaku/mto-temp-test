import {
    BUILD_BASE_FOLDER,
    CLIENT_BUILD_FOLDER,
    CLIENT_REPO_FOLDER,
    COMMON_BUILD_FOLDER,
    COMMON_REPO_FOLDER,
    UIKIT_BUILD_FOLDER,
    UIKIT_REPO_FOLDER
} from "../../actions/build/sharedPackages";
import { BuildBlueprint, BuildType, getBuildBlueprint, getLocalBuildBlueprint } from "../../lib/pipeline";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { IServiceSpec, WebAppBundler, getServiceDir } from "../../config/services";
import { buildDockerImage, getNonSharedServiceSpecForDirectory } from "../../actions/docker/build";
import { dumpFile, listDirectory } from "../../lib/fs";
import { createCorpSiteAliasesNginxConfig } from "../../lib/staticsites";
import { flatten } from "ramda";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { getNodeVersions } from "../../actions/build/node";
import { installExtraApkPackages } from "../../actions/build/alpine";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

function getOptions() {
    const programDefinition: IProgramDefinition = {
        service: {
            long: "service",
            description: "The service folder",
            kind: OptionType.STRING,
            required: true
        }
    };
    const parser = new CommandLineParser("serviceBuild", programDefinition);
    return parser.parse<{ service: string }>();
}

function getRequiredItems(serviceFolder: string) {
    return [
        serviceFolder,
        CLIENT_REPO_FOLDER,
        UIKIT_REPO_FOLDER,
        COMMON_REPO_FOLDER,
        "package.json",
        ".eslintrc",
        ".yarnrc.yml",
        ".yarn",
        "yarn.lock",
        "tsconfig.base.json",
        "tsconfig.client.json",
        "tsconfig.service.json",
    ];
}

function setupClient() {
    return [
        `RUN rm -rf ${CLIENT_BUILD_FOLDER}/lib`,
        `RUN rm -rf ${CLIENT_BUILD_FOLDER}/tsconfig.tsbuildinfo`,
        "RUN yarn workspace @binders/client transpile",
        `RUN cp -r ${CLIENT_BUILD_FOLDER}/assets ${CLIENT_BUILD_FOLDER}/lib`,
    ]
}

function setupCommon() {
    return [
        `RUN rm -rf ${COMMON_BUILD_FOLDER}/lib`,
        `RUN rm -rf ${COMMON_BUILD_FOLDER}/tsconfig.tsbuildinfo`,
        "RUN yarn workspace @binders/binders-service-common transpile",
        `RUN cp -r ${COMMON_BUILD_FOLDER}/assets ${COMMON_BUILD_FOLDER}/lib`,
    ]
}

function setupUikit() {
    return [
        `RUN rm -rf ${UIKIT_BUILD_FOLDER}/lib`,
        `RUN rm -rf ${UIKIT_BUILD_FOLDER}/tsconfig.tsbuildinfo`,
        "RUN yarn workspace @binders/ui-kit transpile",
        "RUN cd " + UIKIT_BUILD_FOLDER + "/src && for f in `find . -name \"*.styl\"` ; do cp --parents $f ../lib ; done",
        "RUN cd " + UIKIT_BUILD_FOLDER + "/src && for f in `find . -name \"*.json\"` ; do cp --parents $f ../lib ; done"
    ]
}

function checkUnimported(workspace: string) {
    return [
        `RUN yarn workspace ${workspace} exec yarn dlx unimported@1.6.0`,
    ];
}

function getNodeModuleLocations(folders: string[]) {
    const locations = folders
        .map(f => [
            `${f}/node_modules`,
            `${f}/app/node_modules`,
            `${f}/client/node_modules`,
            `${f}/service/node_modules`,
        ]);
    return flatten(locations);
}

async function createDockerIgnore(repoRoot: string, serviceFolder: string) {
    const requiredItems = getRequiredItems(serviceFolder);
    const items = await listDirectory(repoRoot);
    const toIgnore = [
        ...items.filter(i => !requiredItems.includes(i)),
        ...getNodeModuleLocations(requiredItems),
    ];
    await dumpFile(`${repoRoot}/.dockerignore`, toIgnore.join("\n"));
}

function runTypeCheck(workspace: string): string[] {
    return [
        `RUN yarn workspace ${workspace} tsc --noEmit`,
    ]
}

function getFrontendBuildSteps(spec: IServiceSpec, buildType: "client" | "service") {
    const specToWorkSpace = (suffix: string) => `@binders/${spec.name}-${spec.version}${suffix}`;
    const clientWorkspace = specToWorkSpace("-client");
    const serviceWorkspace = specToWorkSpace("");
    const webAppBundler = spec.webAppBundler?.at(0) ?? WebAppBundler.Webpack;
    const buildDetails = buildType === "client" ?
        {
            extraSetupSteps: [
                ...setupUikit(),
                ...runTypeCheck(clientWorkspace)
            ],
            buildCommand: `build:${webAppBundler}`,
            workspace: clientWorkspace,
        } :
        {
            extraSetupSteps: setupCommon(),
            buildCommand: `transpile:${webAppBundler}`,
            workspace: serviceWorkspace,
        };
    const steps = [
        ...buildDetails.extraSetupSteps,
        `RUN yarn workspace ${buildDetails.workspace} ${buildDetails.buildCommand}`,
        ...checkUnimported(buildDetails.workspace),
    ];
    return steps;
}

async function createStaticPagesDockerFile(repoRoot: string, serviceFolder: string): Promise<void> {
    await createCorpSiteAliasesNginxConfig(repoRoot, serviceFolder);
    const steps = [
        "FROM nginxinc/nginx-unprivileged",
        // Backend configurations
        `COPY ${serviceFolder}/conf.d/ /etc/nginx/conf.d/`,
        `COPY ${serviceFolder}/assets/ /usr/share/nginx/html/assets/`,
        // Backend files
        `COPY ${serviceFolder}/maintenance/ /usr/share/nginx/html/maintenance/`,
        `COPY ${serviceFolder}/indebanvandetijd/ /usr/share/nginx/html/indebanvandetijd/`,
        `COPY ${serviceFolder}/telltree/ /usr/share/nginx/html/telltree/`,
        // `COPY ${serviceFolder}/bindersmedia/ /usr/share/nginx/html/bindersmedia/`,
        `COPY ${serviceFolder}/testnewip/ /usr/share/nginx/html/testnewip`
    ];
    await dumpFile(`${repoRoot}/Dockerfile`, steps.join("\n"));
}

async function createFrontendServiceDockerFile(repoRoot: string, serviceFolder: string, spec: IServiceSpec) {
    const { build } = getNodeVersions(serviceFolder);
    const serviceServiceFolder = `${serviceFolder}/service`;
    const serviceServiceBuildFolder = `${BUILD_BASE_FOLDER}/${serviceServiceFolder}`;
    const steps = [
        `FROM ${build}`,
        `WORKDIR ${BUILD_BASE_FOLDER}`,
        "COPY . .",
        "RUN apk -U upgrade",
        "RUN npm i -g npm",
        "RUN yarn install",
        ...setupClient(),
        ...getFrontendBuildSteps(spec, "client"),
        ...getFrontendBuildSteps(spec, "service"),
        "ARG BITBUCKET_COMMIT",
        "ARG BITBUCKET_BRANCH",
        `RUN mkdir -p ${serviceServiceBuildFolder}`,
        ...getImageCommand(spec)
    ]
    await dumpFile(`${repoRoot}/Dockerfile`, steps.join("\n"));
}

function getWorkspace(spec: IServiceSpec) {
    return `@binders/${spec.name}-${spec.version}`;
}

function getImageCommand(spec: IServiceSpec) {
    const workspace = getWorkspace(spec);
    const webAppBundler = spec.webAppBundler?.at(0) ?? WebAppBundler.Webpack;
    const startCommand = spec.isFrontend ? `start:${webAppBundler}` : "start";
    const finalSteps = [
        // eslint-disable-next-line quotes
        `RUN mkdir /app && echo "{\\"commit\\": \\"$BITBUCKET_COMMIT\\", \\"branch\\":\\"$BITBUCKET_BRANCH\\"}" > /app/buildinfo.json`,
        `CMD ["yarn", "workspace", "${workspace}", "${startCommand}"]`,
        "ENV NODE_ENV production",
        `WORKDIR ${BUILD_BASE_FOLDER}`,
    ];
    if (spec.name !== "devops") {
        finalSteps.push("USER node");
    }
    return finalSteps;
}

async function createAPIServiceDockerFile(repoRoot: string, serviceFolder: string, spec: IServiceSpec) {
    const serviceBuildFolder = `${BUILD_BASE_FOLDER}/${serviceFolder}`;
    const serviceAppFolder = `${serviceBuildFolder}/app`;
    const { runtime } = getNodeVersions(serviceFolder);
    const workspace = getWorkspace(spec);
    const updateCommand = spec.name === "devops" ? "RUN apt-get update && apt-get upgrade -y" : "RUN apk -U upgrade"
    const steps = [
        `FROM ${runtime}`,
        updateCommand,
        `RUN mkdir -p ${serviceAppFolder}`,
        `WORKDIR ${BUILD_BASE_FOLDER}`,
        "COPY . .",
        "RUN npm i -g npm@7.24.2",
        "RUN yarn install",
        ...setupClient(),
        ...setupCommon(),
        `RUN yarn workspace ${workspace} transpile`,
        "ARG BITBUCKET_COMMIT",
        "ARG BITBUCKET_BRANCH",
        ...installExtraApkPackages(serviceFolder),
        ...getImageCommand(spec),
        ...checkUnimported(workspace),
    ]
    await dumpFile(`${repoRoot}/Dockerfile`, steps.join("\n"));
}

async function createDockerFile(repoRoot: string, serviceFolder: string) {
    const serviceSpec = getNonSharedServiceSpecForDirectory(serviceFolder);
    if (serviceSpec === undefined) {
        throw new Error(`Invalid service folder ${serviceFolder}`);
    }
    if (serviceSpec.name === "static-pages") {
        await createStaticPagesDockerFile(repoRoot, serviceFolder);
        return;
    }
    if (serviceSpec.isFrontend) {
        await createFrontendServiceDockerFile(repoRoot, serviceFolder, serviceSpec);
    } else {
        await createAPIServiceDockerFile(repoRoot, serviceFolder, serviceSpec);
    }
}

async function createBuildContext(repoRoot: string, serviceFolder: string) {
    await createDockerIgnore(repoRoot, serviceFolder);
    await createDockerFile(repoRoot, serviceFolder);
}

async function shouldBuild(serviceFolder: string) {
    try {
        const blueprint = await getBuildBlueprint();
        const buildTask = blueprint.plan[serviceFolder];
        return buildTask.buildType === BuildType.FULL;
    } catch (err) {
        return (err.code === "ENOENT");
    }
}

async function runBuild(repoRoot: string, serviceFolder: string) {
    let blueprint: BuildBlueprint;
    try {
        blueprint = await getBuildBlueprint();
    } catch (err) {
        if (err.code !== "ENOENT") {
            throw err;
        }
        blueprint = await getLocalBuildBlueprint(serviceFolder)
    }
    const BITBUCKET_COMMIT = blueprint.currentCommitRef;
    const BITBUCKET_BRANCH = blueprint.currentBranch;
    const args = { BITBUCKET_BRANCH, BITBUCKET_COMMIT };
    const serviceTask = blueprint.plan[serviceFolder];
    const serviceSpec = getNonSharedServiceSpecForDirectory(serviceFolder);
    const imageSpec = {
        name: getServiceDir(serviceSpec),
        dockerFile: `${repoRoot}/Dockerfile`,
        context: repoRoot
    }
    await buildDockerImage(blueprint, serviceTask, imageSpec, args);
}

main(async () => {
    const { service } = getOptions();
    const repoRoot = await getLocalRepositoryRoot();
    if (! await shouldBuild(service)) {
        log(`Skipping build of ${service}`);
        process.exit(0);
    }
    await createBuildContext(repoRoot, service);
    await runBuild(repoRoot, service);
});
