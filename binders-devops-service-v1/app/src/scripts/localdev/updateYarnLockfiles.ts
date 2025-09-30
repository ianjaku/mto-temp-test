import {
    CLIENT_REPO_FOLDER,
    COMMON_REPO_FOLDER,
    UIKIT_REPO_FOLDER
} from  "../../actions/build/sharedPackages";
import { IServiceSpec, getServiceDir } from "../../config/services";
import {
    getServicesToBuild as getAllServiceBuildCandidates,
    rmrf
} from  "../../actions/localdev/build";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { runCommand } from "../../lib/commands";

function validateServiceName(allServices: IServiceSpec[], candidate: string) {
    const service = allServices.find(s => s.name === candidate);
    if (!service) {
        throw new Error(`Invalid service candidate: "${service}"`);
    }
    return service;
}

function getServicesToUpdate() {
    const allServices = getAllServiceBuildCandidates();
    const toBuild = [];
    for (let i=2; process.argv[i] !== undefined; i++) {
        const service = validateServiceName(allServices, process.argv[i]);
        toBuild.push(service);
    }
    return toBuild.length > 0 ? toBuild : allServices;
}

async function updateLockFile(folder: string) {
    await rmrf(`${folder}/node_modules`);
    await rmrf(`${folder}/yarn.lock`);
    await rmrf(`${folder}/.yarn/cache`);
    await rmrf(`${folder}/package-lock.json`);
    await runCommand("yarn", ["install"], { cwd: folder, shell: true });
}

main( async () => {
    const repoRoot = await getLocalRepositoryRoot();
    const servicesToupdate = getServicesToUpdate();
    log("Updating client yarn.lock");
    await updateLockFile(`${repoRoot}/${CLIENT_REPO_FOLDER}`);
    log("Updating uikit yarn.lock");
    await updateLockFile(`${repoRoot}/${UIKIT_REPO_FOLDER}`);
    log("Updating common yarn.lock");
    await updateLockFile(`${repoRoot}/${COMMON_REPO_FOLDER}`);
    for (const serviceSpec of servicesToupdate) {
        const serviceDir = getServiceDir(serviceSpec);
        const serviceId = `${serviceSpec.name}-${serviceSpec.version}`;
        if (serviceSpec.isFrontend) {
            log(`Updating client yarn.lock in ${serviceId}`);
            await updateLockFile(`${repoRoot}/${serviceDir}/client`);
            log(`Updating service yarn.lock in ${serviceId}`);
            await updateLockFile(`${repoRoot}/${serviceDir}/service`);
        } else {
            log(`Updating yarn.lock in ${serviceId}`);
            await updateLockFile(`${repoRoot}/${serviceDir}/app`);
        }
    }
})