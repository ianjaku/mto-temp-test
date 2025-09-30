/* eslint-disable @typescript-eslint/no-var-requires */
import { AccountUserSpecs, ItemHierarchy } from "./contract";
import { UNIQ_SUFFIX_LENGTH } from ".";
import { isStaging } from "@binders/client/lib/util/environment";
const fs = require("fs");
const path = require("path");

export const itemHierarchyToDepthFirstPath = (itemHierarchy: ItemHierarchy, includeSelf = true): string[] => {
    const path = [];
    let item = includeSelf ? itemHierarchy : itemHierarchy.children[0];
    while (item) {
        path.push(item.name);
        item = item.children && item.children[0];
    }
    return path;
}

function buildPath(relativeBaseName: string) {
    return path.join(__dirname, relativeBaseName);
}

function getEnvFileName(target: string) {
    if (isStaging()) {
        const stagingCandidate = `${target}.staging.json`;
        if (fs.existsSync(buildPath(stagingCandidate))) {
            return stagingCandidate;
        }
    }
    const candidate = `${target}.json`;
    return candidate;
}

function loadJSON(path: string) {
    return require(path);
}

export function loadConfigJSON<E>(target: string): E {
    let path = buildPath(`../${getEnvFileName(target)}`);
    if (fs.existsSync(path)) {
        return loadJSON(path);
    }
    path = buildPath(`../${target}`);
    if (!fs.existsSync(path)) {
        throw new Error(`Could not locate required config file ${path}`);
    }
    return loadJSON(path);
}

function injectSuffixInLogin(login: string, suffix: string): string {
    return login.replace(/(.*)@(.*)\.(.*)/, `$1${suffix}@$2.$3`);
}

function makeAccountUnique(spec: AccountUserSpecs, suffix: string): AccountUserSpecs {
    spec.account.name = `${spec.account.name}-${suffix}`;
    spec.account.domain = spec.account.domain.replace(/(.*)\.manual\.to/, `$1${suffix}.manual.to`);
    for (const i in spec.account.members) {
        spec.account.members[i].login = injectSuffixInLogin(spec.account.members[i].login, suffix);
    }
    return spec;
}

function makeHierarchyUnique(hierarchy: ItemHierarchy, suffix: string): ItemHierarchy {
    if (hierarchy.type === "document") {
        return hierarchy;
    }
    const { children } = hierarchy;
    if (!children) {
        return hierarchy;
    }
    const updatedChildren = children.map((child) => {
        if (!child.aclsToAssign) {
            return makeHierarchyUnique(child, suffix);
        }
        const updatedAcls = child.aclsToAssign.map((acl) => ({ ...acl, login: injectSuffixInLogin(acl.login, suffix) }));
        const updatedChild = { ...child, aclsToAssign: updatedAcls };
        return makeHierarchyUnique(updatedChild, suffix);
    });
    return { ...hierarchy, children: updatedChildren } as ItemHierarchy;
}

export function deUniqueLogin(login: string): string {
    const [username, domain] = login.split("@");
    return `${deUnique(username)}@${domain}`;
}

function deUnique(word: string): string {
    return word.substring(0, word.length - UNIQ_SUFFIX_LENGTH);
}

export function loadAccountUserSpec(name: string, suffix: string): AccountUserSpecs {
    const specs = loadSeedDataJSON<AccountUserSpecs>("accountUserSpecs", name);
    return makeAccountUnique(specs, suffix);

}

export function loadItemHierarchy(name: string, suffix: string): ItemHierarchy {
    const hierarchy = loadSeedDataJSON<ItemHierarchy>("itemHierarchy", name);
    return makeHierarchyUnique(hierarchy, suffix);
}

function loadSeedDataJSON<E>(pathInSeedData: string, name: string): E {
    return loadJSON(buildPath(`./seedData/${pathInSeedData}/${name}.json`));
}
