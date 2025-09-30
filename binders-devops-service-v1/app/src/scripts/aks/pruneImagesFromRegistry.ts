import { ACR_NAME, DEFAULT_BUILD_IMAGE_VERSION } from "../../actions/docker/build";
import {
    deleteImageVersion,
    listImageVersions,
    listRepositories
} from "../../actions/aks/registry";
import {
    doACRLogin,
    doAzureLogin,
    installAKSCli,
    setAzureSubscription,
} from "../../actions/aks/setup";
import { getProductionCluster, getStagingCluster, getSubscriptionForCluster } from "../../actions/aks/cluster";
import { BindersConfig } from "../../lib/bindersconfig";
import { any } from "ramda";
import { existsSync } from "fs";
import { getDeployments } from "../../actions/k8s/deployments";
import { getK8SNamespaces } from "../../actions/k8s/namespaces";
import { loadJSON } from "../../lib/json";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { runGetKubeCtlConfig } from "../../lib/commands";
import { sequential } from "../../lib/promises";
import moment = require("moment");

const branchBuildImages = [
    "binders-api-build", //branch + commit
    "binders-client", //branch + commit
    "binders-common", //branch + commit
    "binders-ui-kit", //branch + commit
    "binders-frontend-build", //branch + commit
    "binders-service-build", //branch + commit
];
const sharedBuildImages = [
    "binders-build", // date
    "binders-build-frontend", // date
    "binders-service-default", //date
];

const cleanSharedBuildImages = async (registryName, repositoryName, versions) => {
    const cmp = (left, right) => {
        const leftMoment = moment(left.timestamp);
        const rightMoment = moment(right.timestamp);
        if (leftMoment.isBefore(rightMoment)) {
            return 1;
        }
        if (leftMoment.isAfter(rightMoment)) {
            return -1;
        }
        return 0;
    }
    const sortedVersions = versions.filter(v => v.tags.indexOf(DEFAULT_BUILD_IMAGE_VERSION) === -1);
    sortedVersions.sort(cmp);
    for (let i = 2; i < sortedVersions.length; i++) {
        log(`Deleting image ${i - 2} / ${sortedVersions.length - 2}`)
        deleteImageVersion(registryName, repositoryName, sortedVersions[i]);
    }
}

const cleanRepository = async (registryName, repositoryName, imageSetToKeep, stagingNamespaces) => {
    log(`Listing image versions for ${repositoryName}`);
    const versions = await listImageVersions(registryName, repositoryName);

    if (sharedBuildImages.indexOf(repositoryName) > -1) {
        return cleanSharedBuildImages(registryName, repositoryName, versions);
    }
    let versionFilter = version => {
        return !any(
            (tag) => {
                const fullImageTag = `${ACR_NAME}/${repositoryName}:${tag}`;
                return imageSetToKeep.has(fullImageTag) ||
                    stagingNamespaces.indexOf(tag) > -1
            },
            version.tags
        );
    };

    if (repositoryName.startsWith("local-dev-")) {
        versionFilter = version => version.tags.indexOf("latest") === -1;
    }
    if (branchBuildImages.indexOf(repositoryName) > -1) {
        versionFilter = version => !any(
            (tag) => stagingNamespaces.indexOf(tag) > -1,
            version.tags
        )
    }

    const cutoff = moment().subtract(21, "days");
    const toDelete = versions
        .filter(v => moment(v.timestamp).isBefore(cutoff))
        .filter(versionFilter);


    log(`Number of ${repositoryName} images no longer used: ${toDelete.length} / ${versions.length}`);
    let i = 1;
    await sequential(
        async (version) => {
            log(`Deleting image ${i} / ${toDelete.length}`);
            i++;
            await deleteImageVersion(registryName, repositoryName, version);
        },
        toDelete
    );
};


const getK8sDeployments = async (clusterName: string) => {
    const subscription = await getSubscriptionForCluster(clusterName)
    await setAzureSubscription(subscription);
    await runGetKubeCtlConfig(clusterName, true);
    return await getDeployments("--all");
}

const login = async () => {
    const config: BindersConfig = await loadJSON("/etc/binders/production.json");
    const servicePrincipal = config.azure.servicePrincipal["devops"];
    const azureTenantId = config.azure.subscription.tenantId;
    await doAzureLogin(servicePrincipal.login, servicePrincipal.password, azureTenantId);
    await installAKSCli();
    await doACRLogin();
}

main(async () => {
    const infoFile = "/app/buildinfo.json";
    if (existsSync(infoFile)) {
        log(await loadJSON("/app/buildinfo.json"));
    } else {
        log("No buildinfo available");
    }
    await login();
    const registryName = "binders";
    log("Listing deployments on production...");
    const productionDeploys = await getK8sDeployments(getProductionCluster());
    log("Listing deployments on staging...");
    const stagingDeploys = await getK8sDeployments(getStagingCluster());
    const stagingNamespaces = await getK8SNamespaces();
    const allDeploys = [...productionDeploys, ...stagingDeploys];
    const imageSetToKeep: Set<unknown> = allDeploys
        .reduce((reduced, deploy) => {
            const images = deploy.spec.template.spec.containers
                .map(c => c.image)
                .filter(i => i.startsWith(ACR_NAME));
            images.forEach(i => reduced.add(i));
            return reduced;
        }, new Set())
    log(`Number of images to keep ${imageSetToKeep.size}`)

    log("Listing repositories...");
    const repositories = await listRepositories(registryName);
    log("Start cleaning...")
    return repositories.reduce(async (reduced, repository) => {
        await reduced;
        return cleanRepository(registryName, repository, imageSetToKeep, stagingNamespaces);
    }, Promise.resolve());
});

