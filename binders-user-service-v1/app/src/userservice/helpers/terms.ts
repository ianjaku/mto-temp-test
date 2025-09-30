import * as fsExtra from "fs-extra";
import * as path from "path";
import { ITermsMap } from "@binders/client/lib/clients/userservice/v1/contract";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { validateAccountId } from "@binders/client/lib/clients/validation";

const TERMSROOT = "./static/terms";

let latestVersionsMap: ITermsMap;

interface IInfoJson {
    titleOverride: string;
}

function getInfoJson(latestVersionPath: string): IInfoJson | undefined {
    try {
        const infoFileContents = fsExtra.readFileSync(path.join(latestVersionPath, "options.json"), "utf-8");
        return infoFileContents && JSON.parse(infoFileContents);
    } catch (e) {
        if (!(e.message.includes("no such file or directory"))) {
            throw e;
        }
        return undefined;
    }
}

export function buildTermsVersionsMap(logger: Logger): ITermsMap {
    if (latestVersionsMap) {
        return latestVersionsMap;
    }
    latestVersionsMap = fsExtra.readdirSync("./static/terms").reduce((reduced, termsEntry) => {
        if (!validateAccountId(termsEntry)) {
            return reduced;
        }
        try {
            const accountId = termsEntry;
            const versionEntries = fsExtra.readdirSync(path.join(TERMSROOT, accountId));
            const latestVersion = [...versionEntries.sort()].pop();
            if (!latestVersion) {
                return reduced;
            }
            const languageDirs = fsExtra.readdirSync(path.join(TERMSROOT, accountId, latestVersion));
            const contentMap = languageDirs.reduce((reduced, languageCode) => {
                const languageCodeDir = path.join(TERMSROOT, accountId, latestVersion, languageCode);
                const info = getInfoJson(languageCodeDir);
                return {
                    ...reduced,
                    [languageCode]: {
                        content:
                            fsExtra.readFileSync(path.join(languageCodeDir, "content.html"), "utf-8"),
                        info,
                    }
                }
            }, {});
            return {
                ...reduced,
                [accountId]: {
                    contentMap,
                    version: latestVersion
                }
            }
        } catch (e) {
            logger.error(`Error in building terms versions map: ${e.message}. Incorrect file structure?`, "buildTermsVersionsMap");
            return reduced;
        }
    }, {});
    return latestVersionsMap;
}