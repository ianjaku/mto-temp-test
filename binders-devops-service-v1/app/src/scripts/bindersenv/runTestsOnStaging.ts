import { BindersConfig, buildBindersStagingConfig } from "../../lib/bindersconfig";
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import {
    FIRST_INTEGRATION_SLOT,
    FIRST_PLAYWRIGHT_SLOT,
    STAGING_ALWAYS_DEPLOY_BRANCHES,
    TOTAL_INTEGRATION_SLOTS,
    TOTAL_PLAYWRIGHT_SLOTS
} from "../../lib/bitbucket";
import { dumpJSON, loadJSON } from "../../lib/json";
import {
    executeScriptPlan,
    filterWorkspacesWithScripts,
    getWorkspacesToTest,
    localYarnLaunch,
    printScriptsMatrix,
    printScriptsResults,
    verifyScriptsResults
} from "../../lib/tests";
import { runClientTranspile, runCommonTranspile } from "../../actions/bindersenv/pipeline";
import { shortenBranchName, shortenCommitRef } from "../../lib/k8s";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { acquireTestsErrorLease } from "../../actions/k8s/lease";
import { basename } from "path";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { getPipelineNamespace } from "../../lib/bindersenvironment";
import { listDirectory } from "../../lib/fs";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { mkdirSync } from "fs";
import { runCommand } from "../../lib/commands";

const ALLOWED_TEST_TYPES = ["INTEGRATION", "PLAYWRIGHT"] as const;
type TestType = typeof ALLOWED_TEST_TYPES[number];
type ArgsOptions = {
    branch: string;
    commit: string;
    testType: TestType;
    namespace?: string;
    slot?: number;
    pattern?: string;
    skipUnchangedWorkspaces?: boolean;
    useCustomNamespacePrefix?: boolean;
};
const getOptions = (): ArgsOptions => {
    const programDefinition: IProgramDefinition = {
        branch: {
            long: "branch",
            short: "b",
            description: "The git branch to deploy",
            kind: OptionType.STRING,
            default: process.env.BITBUCKET_BRANCH,
            required: true
        },
        commit: {
            long: "commit",
            description: "The commit of the active environment",
            kind: OptionType.STRING,
            default: process.env.BITBUCKET_COMMIT,
            required: true
        },
        testType: {
            long: "test-type",
            description: "The type of test to run",
            kind: OptionType.STRING,
            default: process.env.TEST_TYPE,
            required: true
        },
        slot: {
            long: "slot",
            description: "The parallel slot index. Either use this or the pattern parameter",
            kind: OptionType.INTEGER,
            default: process.env.TEST_SLOT,
        },
        pattern: {
            long: "pattern",
            description: "The pattern to match the test files. Either use this or the slot parameter",
            kind: OptionType.STRING
        },
        namespace: {
            long: "namespace",
            description: "The namespace of the active environment",
            kind: OptionType.STRING
        },
        skipUnchangedWorkspaces: {
            long: "skipUnchangedWorkspaces",
            short: "s",
            default: false,
            kind: OptionType.BOOLEAN,
            description: "Only run integration tests for workspaces that have changed since the last succesful build",
        },
        useCustomNamespacePrefix: {
            long: "use-custom-namespace-prefix",
            description: "Use namespace with prefix 'custom-'.",
            kind: OptionType.BOOLEAN
        },
    };
    const parser = new CommandLineParser("deploy", programDefinition);
    const options = parser.parse<ArgsOptions>();
    if (!ALLOWED_TEST_TYPES.includes(options.testType)) {
        log(`Test type ${options.testType} is not recognized`);
        process.exit(1);
    }
    if ((options.slot && options.pattern) || (options.slot == null && options.pattern == null)) {
        log("The script accepts either a slot value parameter or a pattern parameter");
        process.exit(1);
    }
    if (options.namespace && options.useCustomNamespacePrefix) {
        log("Cannot combine namespace and useCustomNamespacePrefix");
        process.exit(1);
    }
    return {
        ...options,
        branch: shortenBranchName(options.branch),
        commit: shortenCommitRef(options.commit),
    };
};

const ensureSlotInRange = (slot: number, start: number, end: number) => {
    if (slot < start || slot > end) {
        throw new Error(`Slot must be in range ${start}..${end}`);
    }
}

const createStagingConfig = async (environmentName: string, branch: string): Promise<BindersConfig> => {
    log("Writing config");
    const config = await buildBindersStagingConfig(environmentName, branch);
    for (const i in config.services) {
        config.services[i].location = config.services[i].externalLocation;
    }
    mkdirSync("/etc/binders", { recursive: true });
    await dumpJSON(config, "/etc/binders/staging.json");
    return config;
}

const createCredentialsJson = async (acceptanceTestsFolder: string) => {
    const configFolder = `${acceptanceTestsFolder}/config`;
    const hierarchyFile = `${configFolder}/boilerplate/seedData/accountUserSpecs/basic.json`;
    const hierarchyContent = await loadJSON(hierarchyFile);
    const adminUser = hierarchyContent.account.members.find(u => u.isAdmin);
    const credentialsFile = `${configFolder}/credentials.json`;
    await dumpJSON(adminUser, credentialsFile);
}

const setupTestData = async (acceptanceTestsFolder: string, config: BindersConfig, testType: TestType) => {
    if (testType === "INTEGRATION") return;
    log("Preparing test data");
    await createCredentialsJson(acceptanceTestsFolder);
    const locationsFile = `${acceptanceTestsFolder}/config/serviceLocations.json`;
    const editor = config.services.editor.externalLocation;
    const manage = config.services.editor.externalLocation.replace("https://editor-", "https://manage-");
    const reader = config.services.editor.externalLocation.replace("https://editor-", "https://manualto-");
    await dumpJSON({ editor, manage, reader }, locationsFile);
};

const getPlayWrightScenariosForSlot = async (slot: number, acceptanceTestsFolder: string) => {
    ensureSlotInRange(slot, FIRST_PLAYWRIGHT_SLOT, FIRST_PLAYWRIGHT_SLOT + TOTAL_PLAYWRIGHT_SLOTS - 1);
    const allFilesInScenarioFolder = await listDirectory(`${acceptanceTestsFolder}/playwright/tests`);
    return allFilesInScenarioFolder
        .filter(path => path.endsWith(".spec.ts"))
        .map(path => basename(path))
        .sort()
        .filter((_filename, i) => (i % TOTAL_PLAYWRIGHT_SLOTS) === (slot - FIRST_PLAYWRIGHT_SLOT));
};

const runPlayWrightTests = async (
    repoRoot: string,
    acceptanceTestsFolder: string,
    branch: string,
    { slot, pattern }: Pick<ArgsOptions, "slot" | "pattern">
): Promise<void> => {
    const testScenarios = pattern ? [pattern] : await getPlayWrightScenariosForSlot(slot, acceptanceTestsFolder);
    log(`Running scenarios that match '${testScenarios.join("', '")}'`);
    await runCommand(
        "yarn",
        ["workspace", "@binders/acceptance", "pw", "--", ...testScenarios],
        {
            cwd: repoRoot,
            env: {
                BINDERS_ENV: "staging",
                RUNS_IN_PIPELINE: "1",
                PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                CI: process.env.CI,
                BITBUCKET_BRANCH: branch,
            },
        }
    );
}

const getWorkspacesForIntegrationTestsSlot = (slot: number) => {
    ensureSlotInRange(slot, FIRST_INTEGRATION_SLOT, FIRST_INTEGRATION_SLOT + TOTAL_INTEGRATION_SLOTS - 1);
    return BINDERS_SERVICE_SPECS
        .filter(spec => !spec.isFrontend)
        .filter(spec => !spec.sharedDeployment)
        .filter(spec => spec.name !== "static-pages")
        .map(spec => `@binders/${spec.name}-${spec.version}`)
        .filter((_, i) => (i % TOTAL_INTEGRATION_SLOTS) === (slot - FIRST_INTEGRATION_SLOT));
}

const runIntegrationTests = async (repoRoot: string, slot: number, skipUnchangedWorkspaces = false) => {
    const env = {
        BINDERS_ENV: "staging",
        PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    };
    const selectedWorkspaces = getWorkspacesForIntegrationTestsSlot(slot);
    const workspacesTest = await getWorkspacesToTest(skipUnchangedWorkspaces);
    const workspaces = workspacesTest.filter(pkg => selectedWorkspaces.includes(pkg.name));
    const executionPlan = filterWorkspacesWithScripts(workspaces, ["integrationtest"]);
    if (executionPlan.length === 0) {
        log("No integration tests to run");
        return;
    }
    printScriptsMatrix(executionPlan);

    const results = await executeScriptPlan(repoRoot, executionPlan, localYarnLaunch, { env, threads: 2 });
    printScriptsResults(results);
    verifyScriptsResults(results);
}

const runTests = async (
    testType: TestType,
    repoRoot: string,
    namespace: string,
    acceptanceTestsFolder: string,
    branch: string,
    skipUnchangedWorkspaces: boolean,
    runOptions: Pick<ArgsOptions, "slot" | "pattern">,
): Promise<void> => {
    log("Start the tests");
    try {
        if (testType === "INTEGRATION") {
            await runIntegrationTests(repoRoot, runOptions.slot, skipUnchangedWorkspaces);
        } else if (testType === "PLAYWRIGHT") {
            await runPlayWrightTests(repoRoot, acceptanceTestsFolder, branch, runOptions);
        } else {
            throw new Error("Unsupported test type");
        }
    } catch (err) {
        await acquireTestsErrorLease(namespace, runOptions.slot);
        throw err;
    }
};

const transpileDependencies = async (repoRoot: string): Promise<void> => {
    await runClientTranspile(repoRoot);
    await runCommonTranspile(repoRoot);
};

const shouldSkipTestsForBranch = (branch: string) =>
    process.env.SKIP_ACCEPTANCE_TESTS === "1" && !STAGING_ALWAYS_DEPLOY_BRANCHES.includes(branch);

const doIt = async () => {
    const { branch, testType, namespace: namespaceOverride, skipUnchangedWorkspaces, useCustomNamespacePrefix, ...runOptions } = getOptions();
    if (shouldSkipTestsForBranch(branch)) {
        log(`Skipping tests for branch ${branch}`);
        process.exit(0);
    }
    const repoRoot = await getLocalRepositoryRoot();
    await transpileDependencies(repoRoot);
    const acceptanceTestsFolder = `${repoRoot}/acceptance-testing`;
    const namespace = namespaceOverride ??
        getPipelineNamespace(useCustomNamespacePrefix);
    const config = await createStagingConfig(namespace, branch);
    await setupTestData(acceptanceTestsFolder, config, testType);
    await runTests(testType, repoRoot, namespace, acceptanceTestsFolder, branch, skipUnchangedWorkspaces, runOptions);
};

main(doIt);
