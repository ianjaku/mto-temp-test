import * as ts from "typescript";
import { basename, dirname } from "path";
import { exists, isDirectory, loadFile, realpath } from "../../lib/fs";
import { getLocalRepositoryRoot } from "../git/local"

const DEFAULT_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".styl"];
export class DepMap {

    _depMap: Record<string, string[]>;
    extensions: string[];

    constructor() {
        this._depMap = {};
        this.extensions = DEFAULT_EXTENSIONS;
    }

    async update(file: string): Promise<void> {
        const importedFiles = await this.getImportedFiles(file);
        for (const importedFile of importedFiles) {
            if (! (importedFile in this._depMap)) {
                this._depMap[importedFile] = [];
            }
            this._depMap[importedFile].push(file);
        }
    }

    private async getImportedFiles(file: string): Promise<string[]> {
        const fileContent = await loadFile(file);
        const srcFile = ts.createSourceFile(file, fileContent, ts.ScriptTarget.Latest);
        const modules = [];
        ts.forEachChild(srcFile, (node: ts.Node) => {
            if (node.kind === ts.SyntaxKind.ImportDeclaration) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const module = (node as any).moduleSpecifier.text;
                modules.push(module);
            }
        });
        const normalizedModules = [];
        for (const module of modules) {
            const nModule = await this.normalizeModule(module, file);
            if (nModule) {
                normalizedModules.push(nModule);
            }
        }
        return normalizedModules;
    }

    private async normalizeModule(module: string, file: string): Promise<string | undefined> {
        if (module.startsWith("@binders")) {
            return this.mapWorkspaceImport(module);
        }
        if (module.startsWith(".")) {
            return this.mapRelativeImport(module, file);
        }
        return undefined;
    }

    private async mapWorkspaceImport(module: string): Promise<string | undefined> {
        const repoRoot = await getLocalRepositoryRoot();
        const mappings = {
            "@binders/client/lib": `${repoRoot}/binders-client-v1/src`,
            "@binders/ui-kit/lib": `${repoRoot}/binders-ui-kit/src`,
            "@binders/binders-service-common/lib": `${repoRoot}/binders-service-common-v1/src`
        }
        for (const key of Object.keys(mappings)) {
            if (module.startsWith(key)) {
                const withoutExtension = module.replace(key, mappings[key]);
                return this.maybeAddExtension(withoutExtension);
            }
        }
        return undefined;
    }

    private async maybeAddExtension(withoutExtension: string): Promise<string | undefined> {
        if (await exists(withoutExtension)) {
            if (await isDirectory(withoutExtension)) {
                return this.maybeAddExtension(`${withoutExtension}/index`);
            } else {
                return withoutExtension;
            }
        }
        for (const extension of this.extensions) {
            const withExtension = `${withoutExtension}${extension}`;
            if (await exists(withExtension)) {
                return withExtension;
            }
        }
        return undefined;
    }

    private async mapRelativeImport(module: string, file: string): Promise<string | undefined> {
        const realp = await realpath(`${dirname(file)}/${dirname(module)}`);
        const withoutExtension = `${realp}/${basename(module)}`;
        return this.maybeAddExtension(withoutExtension);
    }

    getDependants(toAnalyze: string): string[] {

        const processed = new Set();
        const allDeps = [];
        const depMap = this._depMap;
        function step(file: string) {
            const directDependants = depMap[file] || [];
            if (directDependants.length == 0) {
                return;
            }
            for (let i = 0; i < directDependants.length; i++) {
                const dd = directDependants[i]
                if (processed.has(dd)) {
                    continue;
                }
                allDeps.push(dd);
                processed.add(dd);
                step(dd);
            }
        }
        step(toAnalyze);
        return allDeps;

    }

    print(): void {
        for (const key of Object.keys(this._depMap)) {
            // eslint-disable-next-line no-console
            console.log(key);
        }
    }
}