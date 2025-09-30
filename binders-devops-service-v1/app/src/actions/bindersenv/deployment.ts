/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { BINDERS_SERVICE_SPECS, IServiceSpec } from "../../config/services";
import { deleteHPA, getHPAName } from "../../lib/k8s/hpa";
import {
    deleteDeployment as deleteK8sDeployment,
    getDeployments as getK8sDeployments
} from "../k8s/deployments";
import { deletePDB, getPDBName } from "../../lib/k8s/podDistruptionBudget";
import { getServices } from "../k8s/services";
import log from "../../lib/logging";
import { sequential } from "../../lib/promises";
import { toServiceName } from "../../lib/bindersenvironment";

export interface DeploymentDescriptor {
    branch: string;
    commitRef: string;
}

export interface Deployment extends DeploymentDescriptor {
    deploymentGroup: string;
    deployDate: Date;
    expectedReplicas: number;
    availableReplicas: number;
}

export interface ServiceDeployment {
    spec: IServiceSpec;
    candidates: Deployment[];
    activeDeployment: DeploymentDescriptor;
}

const getCandidateLabelMatches = (spec, deployment, deploymentGroups): Deployment => {
    const infix = `${spec.name}-${spec.version}`;
    const deploymentName = deployment.metadata.name;
    const matches = deploymentName.match(new RegExp(`^(.*)-${infix}-(.*)-deployment$`));
    if (!matches) {
        return undefined;
    }
    let deploymentGroup = undefined;
    for (const gId in deploymentGroups) {
        const groupName = `${deploymentGroups[gId].selector.component}-deployment`;
        if (groupName === deploymentName) {
            deploymentGroup = gId;
        }
    }
    return {
        branch: matches[1],
        commitRef: matches[2],
        deployDate: new Date(deployment.metadata.creationTimestamp),
        deploymentGroup,
        expectedReplicas: deployment?.spec?.replicas ?? 0,
        availableReplicas: deployment?.status?.availableReplicas ?? 0,
    };
};

const getDeploymentCandidates = (spec: IServiceSpec, activeDeployments, activeServices): Deployment[] => {
    const activeService = activeServices.find(service => service.metadata.name === toServiceName(spec));
    const deploymentGroups = extractServiceDeploymentGroups(activeService);
    const deployments = activeDeployments
        .map(dep => getCandidateLabelMatches(spec, dep, deploymentGroups))
        .filter(match => !!match);
    deployments.sort(deployCmp);
    return deployments;
};

const getActiveDeployment = (spec, activeServices): DeploymentDescriptor => {
    const serviceName = toServiceName(spec);
    const activeService = activeServices.find(service => service.metadata.name === serviceName);
    if (!activeService) {
        return undefined;
    }
    const infix = `${spec.name}-${spec.version}`;
    const matches = activeService.spec.selector.component.match(new RegExp(`^(.*)-${infix}-(.*)$`));
    return {
        branch: matches[1],
        commitRef: matches[2],
    };
};

const deploymentForSpec = (spec: IServiceSpec, activeDeployments, activeServices): ServiceDeployment => {
    return {
        spec,
        candidates: getDeploymentCandidates(spec, activeDeployments, activeServices),
        activeDeployment: getActiveDeployment(spec, activeServices)
    };
};

export const getDeployments = async (namespace: string): Promise<ServiceDeployment[]> => {
    const activeDeployments = await getK8sDeployments(namespace);
    const activeServices = await getServices(namespace);
    return BINDERS_SERVICE_SPECS
        .filter(spec => !spec.sharedDeployment)
        .map(spec => deploymentForSpec(spec, activeDeployments, activeServices));
};

const deployCmp = (l: Deployment, r: Deployment): number => r.deployDate.getTime() - l.deployDate.getTime();

export const getMostRecentDeployCandidate = (candidates: Deployment[]): Deployment => {
    return [...candidates]
        .sort(deployCmp)
        .shift();
};


type DeleteDeploymentOptions = {
    removeHorizontalPodAutoscaler: boolean
    removePodDisruptionBudged: boolean
}
export const deleteDeployment = async (spec: IServiceSpec, deployment: DeploymentDescriptor, namespace: string, options: DeleteDeploymentOptions = { removeHorizontalPodAutoscaler: true, removePodDisruptionBudged: true }): Promise<void> => {
    const deploymentName = `${deployment.branch}-${spec.name}-${spec.version}-${deployment.commitRef}-deployment`;
    if (options.removeHorizontalPodAutoscaler && spec.replicas !== 1) {
        const name = getHPAName(deploymentName)
        log(`Deleting hpa ${name} from namespace ${namespace}`)
        await deleteHPA(name, namespace)
    }

    if (options.removePodDisruptionBudged) {
        const name = getPDBName(deploymentName)
        log(`Deleting pdb ${name} from namespace ${namespace}`)
        await deletePDB(name, namespace)
    }
    log(`Deleting deployment ${deploymentName} from namespace ${namespace}`);
    await deleteK8sDeployment(deploymentName, namespace);
};

export const getDeploymentsToDelete = async (service: ServiceDeployment, inactiveDeploysToKeep: number) => {
    const candidates = service.candidates.filter(
        c => !service.activeDeployment ||
            (
                c.commitRef !== service.activeDeployment.commitRef ||
                c.branch !== service.activeDeployment.branch
            )
    );
    for (let i = 0; i < inactiveDeploysToKeep; i++) {
        candidates.shift();
    }
    return candidates;
};

export const cleanServiceDeploy = async (deploy: ServiceDeployment, namespace: string, deploysToKeep = 3): Promise<void> => {
    log(`Cleaning deploy candidates for ${deploy.spec.name}-${deploy.spec.version}`);
    const toDelete = await getDeploymentsToDelete(deploy, deploysToKeep);
    log(`Found ${toDelete.length} candidates to delete`);

    await sequential(depCandidate => deleteDeployment(deploy.spec, depCandidate, namespace), toDelete);
};

export const extractServiceDeploymentGroups = (serviceObject) => {
    if (!serviceObject ||
        !serviceObject.metadata.annotations ||
        !serviceObject.metadata.annotations.bindersDeploymentGroups) {
        return {};
    }
    const annotations = serviceObject.metadata.annotations;
    return JSON.parse(annotations.bindersDeploymentGroups) || {};
}

export const setServiceDeploymentGroups = (service, groups, groupId) => {
    if (!service.metadata.annotations) {
        service.metadata.annotations = {};
    }
    service.metadata.annotations.bindersDeploymentGroups = JSON.stringify(groups);
    if (groupId) {
        service.metadata.annotations.bindersActiveDeploymentGroup = groupId;
    }
}

export const getActiveServiceTags = async (namespace: string): Promise<Record<string, string>> => {
    const deploys = await getDeployments(namespace)
    return deploys.reduce((acc, curr) => {
        const key = toServiceName(curr.spec)
        acc[key] = curr.activeDeployment.commitRef
        return acc
    }, {})
}
