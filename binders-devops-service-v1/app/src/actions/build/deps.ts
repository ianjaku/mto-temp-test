import { BINDERS_SERVICE_SPECS, IServiceSpec, getServiceDir } from "../../config/services";
import { isDirectory, listDirectory } from "../../lib/fs";
import { DepMap } from "./depMap"
import { extname } from "path"
import { getLocalRepositoryRoot } from "../git/local"

const DEBUG = false;
const EXTENSIONS_TO_LIST = [".js", ".jsx", ".ts", ".tsx"];
const FIND_EXCLUSIONS = [
    "node_modules",
    "dist",
    "service/public",
    "client/public",
    "binders-devops-service-v1/app/src/infrastructure"
];

interface ListFileOptions {
    exclusions?: Array<string>;
    extensions?: Set<string>;
    debug?: boolean;
}

function shouldExclude(basename: string, fullPath: string, exclusions: Array<string>): boolean {
    return exclusions.some( exc => fullPath.includes(exc) )
}

function log(...args: unknown[]) {
    if (DEBUG) {
        // eslint-disable-next-line no-console
        console.log(...args);
    }
}

async function getAllFilesFromFolder(folder: string, options: Partial<ListFileOptions> = {}): Promise<string[]> {
    const results: string[] = [];
    const exclusions = options.exclusions || [];
    const extensions = options.extensions;
    log(folder);
    async function step(folderStep: string) {
        const entries = await listDirectory(folderStep);
        for (const entry of entries) {
            const fullPath = `${folderStep}/${entry}`;
            if (shouldExclude(entry, fullPath, exclusions)) {
                log(`Excluding ${fullPath} (exclude)`);
                continue;
            }
            if (await isDirectory(fullPath)) {
                await step(fullPath);
            } else {
                if (!extensions) {
                    results.push(fullPath);
                } else {
                    const extension = extname(entry);
                    if (extensions.has(extension)) {
                        results.push(fullPath);
                    } else {
                        log(`Excluding ${fullPath} (extension)`, extension);
                    }
                }
            }
        }
    }
    await step(folder);
    return results;
}

function getFindOptions(): ListFileOptions {
    return {
        exclusions: FIND_EXCLUSIONS,
        extensions: new Set(EXTENSIONS_TO_LIST)
    }
}

async function getAllServiceFiles(spec: IServiceSpec): Promise<string[]> {
    const repoRoot = await getLocalRepositoryRoot();
    const relativeDir = getServiceDir(spec);
    const serviceDir = `${repoRoot}/${relativeDir}`;
    const options = getFindOptions();
    if (spec.isFrontend) {
        const [clientFiles, serverFiles] = await Promise.all([
            getAllFilesFromFolder(`${serviceDir}/client`, options),
            getAllFilesFromFolder(`${serviceDir}/service`, options)
        ]);
        return clientFiles.concat(serverFiles);
    }
    return getAllFilesFromFolder(`${serviceDir}/app`, options);
}

export async function getBuildDepsForServices(specs: IServiceSpec[]): Promise<DepMap> {
    const depMap = new DepMap();
    const workspaces = [
        "binders-client-v1",
        "binders-ui-kit",
        "binders-service-common-v1"
    ];
    const repoRoot = await getLocalRepositoryRoot();
    for (const workspace of workspaces) {
        const fullWorkspacePath = `${repoRoot}/${workspace}/src`;
        const workspaceFiles = await getAllFilesFromFolder(fullWorkspacePath);
        for (let f = 0; f < workspaceFiles.length; f++) {
            await depMap.update(workspaceFiles[f]);
        }
    }
    for(let i = 0; i < specs.length; i++) {
        const serviceFiles = await getAllServiceFiles(specs[i]);
        for (let f = 0; f < serviceFiles.length; f++) {
            await depMap.update(serviceFiles[f]);
        }
    }
    return depMap;
}

async function getDependencyMap() {
    const services = BINDERS_SERVICE_SPECS.filter(
        spec => !spec.sharedDeployment && spec.name != "static-pages"
    );
    return getBuildDepsForServices(services);
}

export async function getChangedDependants(changedFiles: string[]): Promise<string[]> {
    const depMap = await getDependencyMap();
    const repoRoot = await getLocalRepositoryRoot();
    const serviceDirs = new Set<string>();

    const allChangedFilesDependants = changedFiles
        .map(changedFile => `${repoRoot}/${changedFile}`)
        .flatMap(changeFileWithRootPrefix => depMap.getDependants(changeFileWithRootPrefix));
    allChangedFilesDependants
        .map(dependant => dependant.substring(repoRoot.length + 1))
        .map(pathWithoutRootPrefix => pathWithoutRootPrefix.split("/")[0])
        .forEach(serviceDir => serviceDirs.add(serviceDir));

    return Array.from(serviceDirs);
}