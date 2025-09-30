import { BuildType, getBuildBlueprint } from "./pipeline";
import { ICommand, ICommandOptions, buildAndRunCommand, buildKubeCtlCommand } from "./commands";
import { formatDuration, padEnd } from "./utils";
import { groupBy, indexBy, pick, pluck, range, sum } from "ramda";
import { exists } from "./fs";
import { getLocalRepositoryRoot } from "../actions/git/local";
import { isFrontendServiceDirectory } from "../config/services";
import { join } from "path";
import { loadJSON } from "./json";
import log from "./logging";

export interface NpmPackageDefinition {
    dependencies: { [key: string]: string };
    devDependencies: { [key: string]: string };
    name: string;
    scripts: { [key: string]: string };
}

type ScriptLaunchCommandBuilder = (workspace: string, script: WorkspaceScriptName) => ICommand

type NpmPackageDefinitionWithDir = NpmPackageDefinition & { dirPath: string };

type ScriptRunResult = {
    workspace: string,
    script: string,
    status: "success" | "fail",
    output: unknown,
    duration: number,
}

export type WorkspaceScriptName =
    "unittest" |
    "integrationtest" |
    "componenttest" |
    "transpile" |
    "lint";

export const ALL_SCRIPTS: WorkspaceScriptName[] = [
    "lint",
    "transpile",
    "unittest",
    "integrationtest",
    "componenttest"
];

async function promiseAllSeq<I, T>(steps: I[], fn: (i: I) => Promise<T>): Promise<T[]> {
    let result = [] as T[];
    for (const step of steps) {
        const res = await fn(step);
        result = [...result, res];
    }
    return result;
}

async function promiseAll<I, T>(steps: I[], fn: (i: I) => Promise<T>, threads?: number): Promise<T[]> {
    let results: T[];

    if (threads === 0) {
        log("executing in parallel");
        results = await Promise.all(steps.map(fn));
    }
    else if (threads === 1) {
        log("executing sequentially");
        results = await promiseAllSeq(steps, fn);
    }
    else {
        log(`executing in ${threads} 'threads'`);
        const chunkSize = Math.ceil(steps.length / threads);
        const batches = range(0, threads).map(i =>
            promiseAllSeq(
                steps.slice(i * chunkSize, (i + 1) * chunkSize),
                fn,
            )
        );
        results = (await Promise.all(batches)).reduce((res, item) => [...res, ...item]);
    }

    return results;
}


export function executeScriptPlan(
    repoRoot: string,
    plan: NpmPackageDefinitionWithDir[],
    commandBuilder: ScriptLaunchCommandBuilder,
    options: Partial<{ dryRun: boolean, mute: boolean, threads: number } & ICommandOptions>,
): Promise<ScriptRunResult[]> {
    async function testScript({ name: workspace, script }: { name: string, script: string }): Promise<ScriptRunResult> {
        let output: Error | string | null = null;
        let success = false;
        const start = new Date().getTime();
        try {
            if (!options.dryRun) {
                const res = await buildAndRunCommand(
                    () => commandBuilder(workspace, script as WorkspaceScriptName),
                    {
                        cwd: repoRoot,
                        ...options
                    }
                );
                output = res.output;
            }
            success = true;
        } catch (e) {
            output = e;
        }
        if (!options.mute) {
            log(output);
        }
        log(`${padEnd(script, 15)} ${padEnd(workspace, 35)} ${success ? "OK" : "FAIL"}`)
        const duration = new Date().getTime() - start;
        return {
            workspace,
            script,
            status: success ? "success" : "fail",
            output,
            duration,
        };
    }

    const steps = plan.flatMap(({ name, scripts }) =>
        Object.keys(scripts).map(script => ({ name, script }))
    );

    const threads = Math.max(0, options.threads || 0);
    return promiseAll(steps, testScript, threads);
}

export function filterPackageScripts(pJsons: NpmPackageDefinitionWithDir[], scripts = ALL_SCRIPTS): NpmPackageDefinitionWithDir[] {
    return pJsons.map(pkg => ({
        ...pkg,
        scripts: pick(scripts, pkg.scripts)
    }))
}

export function filterWorkspacesWithScripts(
    pJsons: NpmPackageDefinitionWithDir[],
    scripts: WorkspaceScriptName[],
    { matchAll } = { matchAll: true }
): NpmPackageDefinitionWithDir[] {
    const numberOfScriptsToMatch = matchAll ? scripts.length : 1;
    return filterPackageScripts(pJsons, scripts)
        .filter(pkg => Object.keys(pkg.scripts).length >= numberOfScriptsToMatch);
}

export async function toNpmPackageDefinition (dirPath: string): Promise<NpmPackageDefinitionWithDir | undefined> {
    const repoRoot = await getLocalRepositoryRoot();
    const packageJsonPath = join(repoRoot, dirPath, "package.json");
    if (!await exists(packageJsonPath)) {
        return undefined;
    }
    const pkgJson: NpmPackageDefinition = await loadJSON(packageJsonPath);
    return { dirPath, ...pkgJson };
}

export async function loadAllPackageJsons(): Promise<NpmPackageDefinitionWithDir[]> {
    const repoRoot = await getLocalRepositoryRoot();
    const rootPackageJSON = await loadJSON(join(repoRoot, "package.json"));
    const workspaces: string[] = rootPackageJSON.workspaces;
    const packageJsonDefs = await Promise.all(workspaces.map(toNpmPackageDefinition));
    return packageJsonDefs.filter(p => !!p);
}

export function localManageYarnLaunch(workspace: string, script: string): ICommand {
    return buildKubeCtlCommand([
        "exec", "-it", "local-dev",
        "-c", "manage-v1",
        "-n", "develop",
        "--",
        "/bin/bash",
        "-c", `yarn workspace ${workspace} ${script}`
    ]);
}

export function localYarnLaunch(workspace: string, script: string): ICommand {
    return {
        command: "yarn",
        args: ["workspace", workspace, script],
    };
}

export function printScriptsMatrix(workspacePackages: NpmPackageDefinitionWithDir[]): void {
    log(`${padEnd("", 10)}${padEnd("service", 40)} ${padEnd("package", 35)} package.json scripts`);
    log("".padEnd(120, "-"));
    for (const pkg of workspacePackages) {
        const testScripts = Object.keys(pkg.scripts);
        const scripts = testScripts.length ? testScripts.join(" ") : "<no matching scripts>";
        const row = `${padEnd(pkg.dirPath, 40)} ${padEnd(pkg.name, 35)} ${scripts}`;
        log(row);
    }
    log();
    log();
}

export function printScriptsResults(results: ScriptRunResult[]): void {
    function printResult(test: ScriptRunResult) {
        if (!test) {
            return "-";
        }
        return test.status === "success" ? "ok" : "fail";
    }

    const resultsByPackage = groupBy(r => r.workspace, results);
    const packages = Object.keys(resultsByPackage).sort();
    log("test results");
    log("".padEnd(80, "-"));
    log([
        padEnd("", 10),
        padEnd("package", 26),
        ...ALL_SCRIPTS.map(s => padEnd(s[0], 8)),
        "duration",
    ].join(""));
    log("".padEnd(80, "-"));
    for (const pkg of packages) {
        const scripts = resultsByPackage[pkg];
        const scriptsByName = indexBy(r => r.script, scripts);
        const row = [
            padEnd(pkg, 35),
            ...ALL_SCRIPTS.map(sc => padEnd(printResult(scriptsByName[sc]), 7)),
            formatDuration(sum(pluck("duration", scripts))),
        ].join(" ");
        log(row);
    }
    log();
}

export function verifyScriptsResults(results: ScriptRunResult[], { quiet = false }: { quiet?: boolean } = {}): void {
    const errors = results.filter(result => result.status === "fail");
    if (errors.length > 0) {
        for (const err of errors) {
            log(`workspace ${err.workspace} script ${err.script} failed after ${formatDuration(err.duration)}`);
            log(err.output);
        }
        if (!quiet) {
            throw new Error(`failed ${errors.length} scripts`);
        }
    }
}

export async function getWorkspacesToTest(skipUnchangedWorkspaces = false) {
    const { plan } = await getBuildBlueprint();
    if (!skipUnchangedWorkspaces) {
        return loadAllPackageJsons();
    }
    const packageDefinitions: NpmPackageDefinitionWithDir[] = [];
    for (const dir of Object.keys(plan)) {
        if (plan[dir].buildType !== BuildType.FULL) {
            continue;
        }
        const packageJsonDir = resolvePackageJsonDir(dir);
        const definition = await toNpmPackageDefinition(packageJsonDir);
        if (definition) {
            packageDefinitions.push(definition);
        }
    }
    return packageDefinitions;
}

const SHARED_COMPONENT_DIRS = new Set(["binders-client-v1", "binders-service-common-v1", "binders-ui-kit"]);
function resolvePackageJsonDir(dir: string): string {
    if (SHARED_COMPONENT_DIRS.has(dir)) {
        return dir;
    } else if (isFrontendServiceDirectory(dir)) {
        return join(dir, "client");
    } else {
        return join(dir, "app");
    }
}