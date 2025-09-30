import * as ts from "typescript";
import { BINDERS_SERVICE_SPECS, getServiceDir } from "../../config/services";
import { IServiceSpec } from "@binders/client/lib/clients/devopsservice/v1/contract"
import { getLocalRepositoryRoot } from "../../actions/git/local"
import { main } from "../../lib/program"
import { readFileSync } from "fs"
import { runCommand } from "@binders/binders-service-common/lib/util/process";

function getImportNodes(file: string) {
    const sourceText = readFileSync(file).toString();
    const srcFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest);
    const importNodes = [];
    ts.forEachChild(srcFile, (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
            importNodes.push(node);
        }
    })
    return importNodes;
}

function validateAPMImport(file: string) {
    const importNodes = getImportNodes(file);
    const importIndex = importNodes.findIndex(node => {
        return node.moduleSpecifier.text === "@binders/binders-service-common/lib/monitoring/apm";
    })
    return importIndex !== 0 ?
        `${file} does not start with the right APM import`:
        undefined;
}

function getEntryPointForServiceSpec(spec: IServiceSpec) {
    const serviceFolder = getServiceDir(spec);
    let entry;
    if (spec.isFrontend) {
        entry = "service/src/main.ts";
    } else {
        entry = spec.name === "image" ? "app/src/api/main.ts": "app/src/main.ts";
    }
    return `${serviceFolder}/${entry}`
}

async function getServiceEntryPoints() {
    const repoRoot = await getLocalRepositoryRoot();
    return BINDERS_SERVICE_SPECS
        .filter(s => (!s.sharedDeployment && s.name !== "static-pages"))
        .map(spec => (
            `${repoRoot}/${getEntryPointForServiceSpec(spec)}`
        ));
}


async function getFilesToBeCommitted(): Promise<string[]> {
    const options = {
        cwd: await getLocalRepositoryRoot(),
        mute: true
    }
    const { output } = await runCommand("git", ["diff", "--name-only", "--cached"], options);
    return output.split("\n")
        .filter(Boolean);
}


async function validateNativePackages() {
    const filesToBeCommitted = await getFilesToBeCommitted();
    const nativeLinuxPackages = filesToBeCommitted
        .filter(
            file => file.includes("linux-x64") && !file.includes("musl")
        );
    if (nativeLinuxPackages.length) {
        // eslint-disable-next-line no-console
        console.error("!!! The following native Linux packages are about to be committed:");
        // eslint-disable-next-line no-console
        console.error(nativeLinuxPackages.join("\n"));
        process.exit(1)
    }
}

async function validateAPMImports() {
    const serviceEntryPoints = await getServiceEntryPoints();
    const results = serviceEntryPoints.map(validateAPMImport);
    const errors = results.filter(r => !!r);
    if (errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(JSON.stringify(errors, null, 4));
        process.exit(1);
    }
}

main( async() => {
    await validateNativePackages();
    await validateAPMImports();
})
