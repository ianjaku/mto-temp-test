import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    FIRST_INTEGRATION_SLOT,
    FIRST_PLAYWRIGHT_SLOT,
    PLAYWRIGHT_AZ_VERSION_TAG,
    TOTAL_INTEGRATION_SLOTS,
    TOTAL_PLAYWRIGHT_SLOTS
} from "../../lib/bitbucket";
import {
    getProductionCluster,
    getStagingCluster
} from "../../actions/aks/cluster";
import { BINDERS_SERVICE_DIRS } from "../../config/services";
import { dumpYaml } from "../../lib/yaml";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { getNonSharedServiceSpecForDirectory } from "../../actions/docker/build";

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        shrink: {
            long: "shrink",
            short: "s",
            description: "Shrink the pipeline to its minimum size",
            kind: OptionType.BOOLEAN,
            default: false
        },
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to shrink",
            kind: OptionType.STRING,
        }
    };
    const parser = new CommandLineParser("generatePipelineDefinition", programDefinition);
    const options = parser.parse();
    if (options.shrink && !options.branch) {
        throw new Error("Cannot shrink without a branch");
    }
    return options;
}

const buildServicePipelineStep = (serviceFolder: string) => {
    const serviceSpec = getNonSharedServiceSpecForDirectory(serviceFolder);
    const size = (serviceSpec.isFrontend || serviceSpec.name === "devops") ?
        "4x" :
        "2x";
    return {
        step: {
            name: `${serviceSpec.name}-${serviceSpec.version}`,
            "max-time": 50,
            services: ["docker"],
            size,
            script: [
                ...devopsSetup,
                "echo $ACR_PASSWORD | docker login binders.azurecr.io -u ${ACR_APP_ID} --password-stdin",
                `yarn workspace @binders/devops-v1 tsx src/scripts/bitbucket/serviceBuild.ts --service ${serviceFolder}`,
            ]
        }
    };
};


interface TestRunOptions {
    runAllUnitTests?: boolean;
    runAllIntegrationTests: boolean;
}

const devopsSetup = [
    "yarn install"
];

// bitbucket uses a clone with --branch so only a small subset of the refs are know after the clone
const fetchAllRefs = "git fetch origin \"+refs/heads/*:refs/remotes/origin/*\"";
const fetchAllTags = "git fetch origin \"refs/tags/*:refs/tags/*\"";

const buildPlanStep = () => {
    return {
        step: {
            name: "Create the build plan",
            "max-time": 35,
            script: [
                ...devopsSetup,
                fetchAllRefs,
                fetchAllTags,
                "yarn workspace @binders/devops-v1 tsx src/scripts/bitbucket/makeBuildPlan.ts --branch ${BITBUCKET_BRANCH} --commit ${BITBUCKET_COMMIT}"
            ],
            artifacts: [
                "binders-devops-service-v1/app/buildplan.json"
            ]
        }
    };
};

const buildUnitTestsStep = (runAllUnitTests = true) => {
    const extraArg = runAllUnitTests ? "" : " --skipUnchangedWorkspaces";
    return {
        step: {
            name: "Run unit tests",
            "max-time": 35,
            size: "4x",
            script: [
                ...devopsSetup,
                `yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/unitTests.ts -m -t 2${extraArg}`,
            ]
        }
    };
};

const buildTagStep = () => {
    return {
        step: {
            name: "Tag the build",
            script: BUILD_TAG_SCRIPT
        }
    };
};


const buildDeployStagingStepScript = (options: {
    pauseBeforeDeploy: boolean,
    useCustomNamespacePrefix?: boolean,
    skipSetup: boolean
}) => {
    const cluster = getStagingCluster();
    const mockServicesFlag = " --mock-services aicontent,mailer";
    const useCustomNamespacePrefix = options.useCustomNamespacePrefix ? " --use-custom-namespace-prefix" : ""
    const setup = options.skipSetup ?
        [] :
        [
            ...devopsSetup,
            fetchAllRefs,
            fetchAllTags,
            "yarn workspace @binders/devops-v1 tsx src/scripts/aks/prepareDeploy.ts staging",
        ];
    return [
        ...setup,
        "yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/deploy.ts --branch ${BITBUCKET_BRANCH} --commit ${BITBUCKET_COMMIT} --use-admin --cluster " + cluster + mockServicesFlag + useCustomNamespacePrefix,
    ]
}
const buildDeployStagingStep = (options: {
    pauseBeforeDeploy: boolean,
    useCustomNamespacePrefix?: boolean,
    skipSetup: boolean
}) => {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step: any = {
        step: {
            "max-time": 30,
            size: "4x",
            image: BITBUCKET_AFTER_BUILD_IMAGE,
            name: "Deploy to staging (with mocked services)",
            script: buildDeployStagingStepScript(options)
        }
    };
    if (options.pauseBeforeDeploy) {
        step.step.trigger = "manual"
    }
    return step;
};

const buildDeployPreprodStep = (pauseBeforeDeploy: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const step: any = {
        step: {
            "max-time": 30,
            size: "2x",
            image: BITBUCKET_AFTER_BUILD_IMAGE,
            name: "Deploy to preprod",
            script: [
                ...devopsSetup,
                fetchAllRefs,
                fetchAllTags,
                "yarn workspace @binders/devops-v1 tsx src/scripts/aks/prepareDeploy.ts production",
                "yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/deployToPreprod.ts --branch ${BITBUCKET_BRANCH}"
            ]
        }
    };
    if (pauseBeforeDeploy) {
        step.step.trigger = "manual"
    }
    return step;
};

const buildRefreshDevelopEnvScript = (namespace: string) => {
    return [
        fetchAllRefs,
        fetchAllTags,
        "yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/refreshDeployments.ts " + namespace
    ]
}


const buildRunIntegrationTests = (skipUnchangedWorkspaces = false, isCustomPipeline = false) => {
    return Array.from(Array(TOTAL_INTEGRATION_SLOTS).keys())
        .map(i => buildRunIntegrationTest(FIRST_INTEGRATION_SLOT + i, skipUnchangedWorkspaces, isCustomPipeline));
}

const buildRunIntegrationTest = (slot: number, skipUnchangedWorkspaces = false, isCustomPipeline = false) => {
    const skipWorkspacesArg = skipUnchangedWorkspaces ? " --skipUnchangedWorkspaces" : "";
    const customNsArg = (isCustomPipeline ? " --use-custom-namespace-prefix" : "")
    return {
        step: {
            "max-time": 40,
            image: BITBUCKET_AFTER_BUILD_IMAGE,
            size: "2x",
            name: `Integration tests (slot ${slot})`,
            script: [
                ...devopsSetup,
                "yarn workspace @binders/devops-v1 tsx src/scripts/aks/prepareDeploy.ts staging",
                `yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/runTestsOnStaging.ts --branch \${BITBUCKET_BRANCH} --commit \${BITBUCKET_COMMIT} --slot=${slot} --test-type=INTEGRATION${skipWorkspacesArg}${customNsArg}`
            ],
            "after-script": [
                `TEST_SLOT=${slot} yarn workspace @binders/devops-v1 tsx src/scripts/aks/maybeCleanNamespace.ts`
            ]
        }
    }
}

const buildRunEnsureLanguageFilesUpToDateScript = () => {
    return {
        step: {
            "max-time": 10,
            image: BITBUCKET_AFTER_BUILD_IMAGE,
            name: "Language files",
            script: [
                ...devopsSetup,
                "yarn workspace @binders/client tsx scripts/ensureLanguageFilesVerified.ts",
            ],
        }
    }
}


const getPlaywrightStepName = (namespace: string, slot: number): string => {
    if (slot !== undefined) {
        return `AT Playwright (slot ${slot})`
    }

    if (namespace !== undefined) {
        return `AT Playwright (run on ${namespace} namespace)`
    }

    return "AT Playwright"
}

const buildRunPlaywrightTest = (
    slot: number | undefined,
    pattern = "",
    checkVarBeforeCleanup = false,
    namespace = undefined,
    useCustomNamespacePrefix = false
) => {
    const suffix = pattern != "" ? ` --pattern ${pattern}` : "";
    const yarnCmd = "yarn workspace @binders/devops-v1 ts-node src/scripts/bindersenv/runTestsOnStaging.ts " +
        "--branch ${BITBUCKET_BRANCH} --commit ${BITBUCKET_COMMIT} --test-type=PLAYWRIGHT" +
        (slot !== undefined ? ` --slot ${slot}` : "") +
        (namespace !== undefined ? ` --namespace ${namespace}` : "") +
        (useCustomNamespacePrefix ? " --use-custom-namespace-prefix" : "") +
        suffix;
    const name = getPlaywrightStepName(namespace, slot);
    const afterScript =
        (slot !== undefined ? `TEST_SLOT=${slot} ` : "") +
        "yarn workspace @binders/devops-v1 ts-node " +
        "src/scripts/aks/maybeCleanNamespace.ts" +
        (checkVarBeforeCleanup ? " --doCleanup ${doCleanup}" : "");
    return {
        step: {
            "max-time": 40,
            image: getImage(`binders.azurecr.io/playwright-az:${PLAYWRIGHT_AZ_VERSION_TAG}`),
            size: "2x",
            name,
            script: [
                ...devopsSetup,
                "yarn workspace @binders/devops-v1 ts-node src/scripts/aks/prepareDeploy.ts staging",
                yarnCmd
            ],
            "after-script": [
                afterScript
            ],
            artifacts: [
                "acceptance-testing/test-results/**"
            ]
        }
    }
}

const buildRunPlaywrightTests = (isCustomPipeline = false, namespace = undefined) => {
    return Array.from(Array(TOTAL_PLAYWRIGHT_SLOTS).keys())
        .map(i => buildRunPlaywrightTest(
            FIRST_PLAYWRIGHT_SLOT + i,
            "",
            false,
            namespace,
            isCustomPipeline
        ));
}

const buildDeployProductionStep = () => {
    const cluster = getProductionCluster()
    const name = "Deploy to production"
    return {
        step: {
            trigger: "manual",
            "max-time": 20,
            image: BITBUCKET_AFTER_BUILD_IMAGE,
            name,
            script: [
                ...devopsSetup,
                fetchAllRefs,
                fetchAllTags,
                "yarn workspace @binders/devops-v1 tsx src/scripts/aks/prepareDeploy.ts production",
                "yarn workspace @binders/devops-v1 tsx src/scripts/bindersenv/deploy.ts --branch ${BITBUCKET_BRANCH} --bitbucket-access-token ${BITBUCKET_ACCESS_TOKEN} --commit ${BITBUCKET_COMMIT} --use-admin --cluster " + cluster,
            ]
        }
    };
};

function getServiceBuildSteps() {
    const excludedServices = ["binders-static-pages-service-v1"]
    return BINDERS_SERVICE_DIRS
        .filter(svc => !excludedServices.includes(svc))
        .map(buildServicePipelineStep);
}

interface PipelineOptions {
    shrink?: boolean;
    pauseBeforeDeploy: boolean;
    refreshDeployment?: boolean;
    testOptions: TestRunOptions;
}

const buildATSteps = (testOptions: TestRunOptions, isCustomPipeline = false, namespace = undefined) => {
    const { runAllIntegrationTests } = testOptions;
    const tests = [
        {
            parallel: [
                ...buildRunPlaywrightTests(isCustomPipeline, namespace),
                ...buildRunIntegrationTests(!runAllIntegrationTests, isCustomPipeline),
            ],
        }
    ]
    return tests
}

const BUILD_TAG_SCRIPT = [
    // https://community.atlassian.com/t5/Bitbucket-Pipelines-articles/Pushing-back-to-your-repository/ba-p/958407
    "git remote set-url origin ${BITBUCKET_GIT_HTTP_ORIGIN}",
    ...devopsSetup,
    "git config user.email \"devops@manual.to\"",
    "git config user.name \"Buildbot@BitBucket\"",
    "yarn workspace @binders/devops-v1 tsx src/scripts/bitbucket/addTag.ts --branch ${BITBUCKET_BRANCH} --commit ${BITBUCKET_COMMIT}"
]

const buildPostBuildSteps = (branch: string, options: PipelineOptions) => {
    const script = [...BUILD_TAG_SCRIPT];
    const postBuildParts = ["tag"];
    if (options.refreshDeployment || !options.shrink) {
        script.push(
            "yarn workspace @binders/devops-v1 tsx src/scripts/aks/prepareDeploy.ts staging",
        )
    }
    if (options.refreshDeployment) {
        script.push(...buildRefreshDevelopEnvScript(branch));
        postBuildParts.push("refresh develop")
    }
    if (!options.shrink) {
        script.push(...buildDeployStagingStepScript({ ...options, skipSetup: true }));
        postBuildParts.push("deploy to staging")
    }
    const steps: unknown[] = [
        {
            step: {
                "max-time": 45,
                size: "4x",
                image: BITBUCKET_AFTER_BUILD_IMAGE,
                name: `Post-build (${postBuildParts.join(", ")})`,
                script
            }
        }
    ]
    if (!options.shrink) {
        steps.push(...buildATSteps(options.testOptions))
    }
    return steps;
}

const buildStagingPipeline = (branch: string, options: PipelineOptions) => {
    return [
        buildPlanStep(),
        {
            parallel: [
                buildUnitTestsStep(options.testOptions.runAllUnitTests),
                ...getServiceBuildSteps()
            ],
        },
        ...buildPostBuildSteps(branch, options)
    ];
};

const buildPreprodPipeline = () => {
    const steps: unknown[] = [
        buildDeployPreprodStep(false)
    ];
    return steps;
};


const buildTestsOnly = () => {
    const testRunOptions = {
        runAllIntegrationTests: true
    }
    return [
        buildPlanStep(),
        buildDeployStagingStep({ pauseBeforeDeploy: false, useCustomNamespacePrefix: true, skipSetup: false }),
        ...buildATSteps(testRunOptions, true)
    ]
}

const buildSinglePlaywrightTest = () => {
    const pattern = "testPattern";
    const doCleanup = "doCleanup";

    return [
        {
            variables: [
                {
                    name: pattern,
                    description: "The filename pattern that will be used to identify test cases to run"
                },
                {
                    name: doCleanup,
                    default: "true",
                    "allowed-values": ["true", "false"],
                    description: "Should the kubernetes namespace be deleted when the test cases complete?"
                }
            ]
        },
        buildPlanStep(),
        buildDeployStagingStep({ pauseBeforeDeploy: false, useCustomNamespacePrefix: true, skipSetup: false }),
        buildRunPlaywrightTest(undefined, `\${${pattern}}`, true, undefined, true)
    ]
}

const buildRunPlaywrightTestOnExistsingEnv = () => {
    const namespace = "namespace"
    return [
        {
            variables: [
                {
                    name: namespace,
                    description: "Namespace on which tests will be run"
                }]
        },
        buildPlanStep(),
        {
            parallel: [
                ...buildRunPlaywrightTests(false, `\${${namespace}}`)
            ]
        }
    ]
}

const buildDevelopTestRun = () => {
    return [
        buildPlanStep(),
        buildRunPlaywrightTest(undefined, "uploadSvg", false, "develop")
    ]
}

const buildDevelopPipeline = () => {
    return [
        ...buildStagingPipeline("develop", {
            pauseBeforeDeploy: false,
            refreshDeployment: true,
            testOptions: {
                runAllUnitTests: true,
                runAllIntegrationTests: true
            }
        }),
        buildRunPlaywrightTest(undefined, "uploadSvg", false, "develop")
    ]
}

const buildTag = () => {
    return [
        buildPlanStep(),
        {
            parallel: getServiceBuildSteps(),
        },
        buildTagStep()
    ];
};

const buildPipeline = () => {
    const fullPipeline = [
        ...buildStagingPipeline("rel-*", {
            pauseBeforeDeploy: false,
            testOptions: {
                runAllUnitTests: true,
                runAllIntegrationTests: true
            }
        }),
        buildRunEnsureLanguageFilesUpToDateScript(),
        buildDeployProductionStep()
    ];

    return {
        pipelines: {
            "branches": {
                "rel-*": fullPipeline,
                "develop": buildDevelopPipeline(),
            },
            "pull-requests": {
                "**": buildStagingPipeline("**", {
                    pauseBeforeDeploy: false,
                    testOptions: {
                        runAllUnitTests: false,
                        runAllIntegrationTests: false
                    }
                })
            },
            "custom": {
                "tests-only": buildTestsOnly(),
                "single-playwright-test": buildSinglePlaywrightTest(),
                "preprod": buildPreprodPipeline(),
                "develop-test": buildDevelopTestRun(),
                "tag-only": buildTag(),
                "pw-tests-on-existsing-env": buildRunPlaywrightTestOnExistsingEnv()
            }
        },
        image: BITBUCKET_ALPINE_IMAGE,
        definitions: {
            services: {
                docker: {
                    memory: 7128
                }
            }
        }
    };
};

const NODE_TAG = "node22";

function getImage(name: string) {
    return {
        name,
        username: "binders",
        password: "$ACR_ADMIN_PASSWORD"
    }
}

const BITBUCKET_AFTER_BUILD_IMAGE = getImage(`binders.azurecr.io/bitbucket-after-build:${NODE_TAG}`);
const BITBUCKET_ALPINE_IMAGE = getImage(`binders.azurecr.io/bitbucket-alpine:${NODE_TAG}`);

function shrinkPipeline(pipeline, branch: string) {
    const isReleaseBranch = branch.startsWith("rel-");
    const testOptions = {
        runAllUnitTests: false,
        runAllIntegrationTests: false
    }
    const shrunkPipeline = buildStagingPipeline(branch, { shrink: true, pauseBeforeDeploy: !isReleaseBranch, testOptions });
    if (isReleaseBranch) {
        shrunkPipeline.push(buildDeployProductionStep());
    }
    pipeline.pipelines.branches[branch] = shrunkPipeline;
}

const dumpPipelineYaml = async () => {
    const options = getOptions();
    const pipeline = buildPipeline();
    if (options.shrink) {
        shrinkPipeline(pipeline, options.branch as string);
    }
    const repoRoot = await getLocalRepositoryRoot();
    await dumpYaml(pipeline, `${repoRoot}/bitbucket-pipelines.yml`);
};

dumpPipelineYaml();
