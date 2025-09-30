/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { BuildBlueprint, BuildType } from "./pipeline";
import { IBindersEnvironment, getNamespace } from "./bindersenvironment";
import { IServiceSpec, getServiceDir } from "../config/services";
import {
    ServiceDeployment,
    getDeployments,
    getMostRecentDeployCandidate
} from "../actions/bindersenv/deployment";
import { getBuildType } from "../actions/docker/build"
import { getChangedDependants } from "../actions/build/deps"
import { getChangedFiles } from "../actions/git/commits"
import { getMostRecentTagDate } from "../actions/git/tags"
import log from "./logging"
import moment from "moment";

export const enum BindersDeploymentStatus {
    UP_TO_DATE,
    OUT_OF_DATE
}

const hasChangedFiles = async (serviceSpec: IServiceSpec, fromRef: string, toRef: string) => {
    try {
        const changedFiles = await getChangedFiles(fromRef, toRef);
        const serviceDir = getServiceDir(serviceSpec);
        const changedDependants = await getChangedDependants(changedFiles);
        return getBuildType(serviceDir, changedFiles, changedDependants) === BuildType.FULL;
    } catch (e) {
        if (e?.output?.includes("unknown revision or path not in the working tree")) {
            log(`Could not find commit ref ${fromRef} or ${toRef}, forcing change`);
            return true;
        }
        throw e;
    }
};

const hasFullBuildSince = async (branch: string, currentDeployment: ServiceDeployment) => {
    const branchPrefix = `${branch}-full`;
    const lastFullTagDate = await getMostRecentTagDate(new RegExp(`^${branchPrefix}-.*$`));
    if (!lastFullTagDate) {
        log(`No tag found with prefix ${branchPrefix}`);
        return false;
    }
    const mostRecentDeploy = getMostRecentDeployCandidate(currentDeployment.candidates);
    log(`Last full ${lastFullTagDate} ?><? last deploy date ${mostRecentDeploy.deployDate}`);
    return moment(mostRecentDeploy.deployDate).isBefore(moment(lastFullTagDate));
};

const getDeploymentStatus = async (serviceSpec: IServiceSpec, environment: IBindersEnvironment,
    currentDeployments: ServiceDeployment): Promise<BindersDeploymentStatus> => {
    const deployCandidate = getMostRecentDeployCandidate(currentDeployments.candidates);
    const commitRef = deployCandidate && deployCandidate.commitRef;
    if (!commitRef) {
        log(`Could not determine commit ref for service ${serviceSpec.name}-${serviceSpec.version}`);
        return BindersDeploymentStatus.OUT_OF_DATE;
    }
    const hasChanged = await hasChangedFiles(serviceSpec, commitRef, environment.commitRef);
    const hadFullBuild = await hasFullBuildSince(environment.branch, currentDeployments);
    if (hasChanged || hadFullBuild) {
        log(`Deployment for service ${serviceSpec.name} is out of date (change: ${hasChanged}, full: ${hadFullBuild})`);
        return BindersDeploymentStatus.OUT_OF_DATE;
    } else {
        log(`Deployment for service ${serviceSpec.name} is up to date`);
        return BindersDeploymentStatus.UP_TO_DATE;
    }
};

export const makeDeploymentPlan = async (environment: IBindersEnvironment, blueprint: BuildBlueprint) => {
    const namespace = getNamespace(environment);
    const currentServiceDeployments = await getDeployments(namespace);
    const serviceDeployStatuses = await Promise.all(
        environment.services.map(async (service) => {
            const serviceToUse = service.sharedDeployment ?
                environment.services.find(s => s.name === service.sharedDeployment) :
                service;
            const currentServiceDeployment = currentServiceDeployments
                .find(dep => dep.spec.name === serviceToUse.name && dep.spec.version === serviceToUse.version);
            const serviceDirectory = getServiceDir(serviceToUse);
            const buildTask = blueprint?.plan[serviceDirectory];
            if (blueprint && !buildTask) {
                log(`Could not find build task for ${serviceDirectory}`);
                return Promise.resolve(BindersDeploymentStatus.UP_TO_DATE);
            }
            return (!blueprint || buildTask.buildType === BuildType.FULL && !environment.isProduction) ?
                Promise.resolve(BindersDeploymentStatus.OUT_OF_DATE) :
                getDeploymentStatus(serviceToUse, environment, currentServiceDeployment);
        })
    );
    const plan: { [key: string]: { version: string, status: BindersDeploymentStatus, name: string } } = {};
    for (let i = 0; i < serviceDeployStatuses.length; i++) {
        const service = environment.services[i];
        const serviceKeyPrefix = service.sharedDeployment || service.name;
        const actualService = service.sharedDeployment ?
            environment.services.find(s => s.name === service.sharedDeployment) :
            service;
        const serviceKey = `${serviceKeyPrefix}-${actualService.version}`;
        if (serviceKey in plan) {
            plan[serviceKey] = plan[serviceKey].status === BindersDeploymentStatus.OUT_OF_DATE ?
                plan[serviceKey] :
                ({
                    name: actualService.name,
                    version: actualService.version,
                    status: serviceDeployStatuses[i]
                });
        } else {
            plan[serviceKey] = {
                name: serviceKeyPrefix,
                version: actualService.version,
                status: serviceDeployStatuses[i]
            };
        }
    }
    return plan;
};

/*
requirements to do production restore:
    * elastic: 2048
    * mongo: 1024
*/
export const STAGING_RESOURCE_REQUESTS = {
    memory: {
        mongo: "1024Mi",
        redis: "128Mi",
        elastic: {
            pod: "2000Mi",
            jvm: "1000m"
        },
        services: {
            default: "400Mi"
        }
    }
}

export const STAGING_RESOURCE_LIMITS = {
    memory: {
        mongo: "1024Mi",
        redis: "128Mi",
        elastic: {
            pod: "2000Mi",
            jvm: "1000m"
        },
        services: {
            default: "800Mi",
            devops: "4096Mi",
            binders: "1024Mi",
        }
    }
}

export const MINIMAL_STAGING_RESOURCE_REQUESTS = {
    memory: {
        mongo: "1024Mi",
        redis: "128Mi",
        elastic: {
            pod: "2Gi",
            jvm: "1000m"
        },
        services: {
            default: "400Mi",
        }
    }
}


export const MINIMAL_STAGING_RESOURCE_LIMITS = {
    memory: {
        mongo: "1024Mi",
        redis: "128Mi",
        elastic: {
            pod: "2Gi",
            jvm: "1000m"
        },
        services: {
            default: "800Mi",
            binders: "1024Mi"
        }
    }
}

export const EXPECTED_PRODUCTION_RESOURCE_LIMITS = {
    memory: {
        services: {
            default: "420Mi",
            binders: "1Gi",
            image: "768Mi",
            tracking: "1256Mi",
            "static-pages": "100Mi",
            screenshot: "1Gi"
        }
    }
}

export const MAX_PRODUCTION_RESOURCE_LIMITS = {
    memory: {
        services: {
            default: "768Mi",
            binders: "2Gi",
            image: "1512Mi",
            partners: "512Mi",
            tracking: "1512Mi",
            "static-pages": "100Mi",
            screenshot: "2Gi"

        }
    }
}

export const LOCALDEV_RESOURCE_LIMITS = {
    memory: {
        services: {
            default: "1Gi",
            binders: "2048Mi",
            image: "1256Mi",
            devops: "4096Mi",
            "static-pages": "100Mi"
        }
    }
}

export function getProductionMemoryLimits(serviceName: string): { expectedMemory: string, maxMemory: string } {
    const expectedServiceLimits = EXPECTED_PRODUCTION_RESOURCE_LIMITS.memory.services
    const maxServiceLimits = MAX_PRODUCTION_RESOURCE_LIMITS.memory.services
    return {
        expectedMemory: expectedServiceLimits[serviceName] || expectedServiceLimits.default,
        maxMemory: maxServiceLimits[serviceName] || maxServiceLimits.default
    }
}

export function getLocalDevMemoryLimits(serviceName: string): string {
    const serviceLimits = LOCALDEV_RESOURCE_LIMITS.memory.services
    return serviceLimits[serviceName] || serviceLimits.default
}

export const getServiceMemoryLimit = (name: string, env: IBindersEnvironment) => {
    const serviceLimits = env.isMinimal ?
        MINIMAL_STAGING_RESOURCE_LIMITS.memory.services :
        STAGING_RESOURCE_LIMITS.memory.services;
    return serviceLimits[name] || serviceLimits.default;
}

export const getServiceMemoryRequests = (name: string, env: IBindersEnvironment) => {
    const serviceLimits = env.isMinimal ?
        MINIMAL_STAGING_RESOURCE_REQUESTS.memory.services :
        STAGING_RESOURCE_REQUESTS.memory.services;
    return serviceLimits[name] || serviceLimits.default;
}