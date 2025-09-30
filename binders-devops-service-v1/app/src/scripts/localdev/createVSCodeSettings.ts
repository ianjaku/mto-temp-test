import { dumpJSON, loadJSON } from "../../lib/json";
import { existsSync, mkdirSync, statSync } from "fs";
import { BINDERS_SERVICE_DIRS } from "../../config/services";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";

const ensureFolder = async (folder: string) => {
    if (!existsSync(folder)) {
        mkdirSync(folder)
    }
}

const safeLoadJSON = async (path: string) => {
    try {
        return await loadJSON(path);
    } catch (err) {
        if (err.message.includes("Unexpected end")) {
            const stats = statSync(path);
            if (stats && stats.size === 0) {
                return {};
            }
        }
        throw err;
    }
}

const ensureSettings = async (folder: string) => {
    const settingsFile = `${folder}/settings.json`;
    log(`Updating settings in file ${settingsFile}`);
    const currentSettings = existsSync(settingsFile) ?
        (await safeLoadJSON(settingsFile)) :
        {};
    const updatedSettings = {
        ...currentSettings,
        "files.trimTrailingWhitespace": true
    };
    await dumpJSON(updatedSettings, settingsFile, true);
}

const configureLocation = async (location: string) => {
    const vsCodeFolder = `${location}/.vscode`;
    await ensureFolder(vsCodeFolder);
    await ensureSettings(vsCodeFolder);
}

const EXTRA_FOLDERS = [
    "acceptance-testing",
    "binders-client-v1",
    "binders-service-common-v1",
    "binders-ui-kit"
]

const doIt = async () => {
    const repoRoot = await getLocalRepositoryRoot();
    const fullDirs = [
        ...BINDERS_SERVICE_DIRS,
        ...EXTRA_FOLDERS
    ].map(d => `${repoRoot}/${d}`);
    const locations = [
        ...fullDirs,
        repoRoot
    ];
    await Promise.all(locations.map(configureLocation));
}

main(doIt);