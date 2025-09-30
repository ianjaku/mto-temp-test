/* eslint-disable no-console */
import {
    DeployedGroup,
    DeploymentGroupItem,
    DevopsServiceContract,
    IServiceSpec,
    ServiceDeployment
} from "@binders/client/lib/clients/devopsservice/v1/contract";
import {
    DeploymentDescriptor,
    deleteDeployment as deleteK8sDeployment,
    getDeployments as getK8sDeployments
} from "../actions/bindersenv/deployment";
import { IBindersEnvironment, PRODUCTION_NAMESPACE } from "../lib/bindersenvironment";
import { getCommitTag, pullImage, pushImage, tagImage } from "../actions/docker/build";
import { IFeatureFlagService } from "@binders/binders-service-common/lib/launchdarkly/server";
import { InvalidArgument } from "@binders/client/lib/util/errors";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { WebRequest } from "@binders/binders-service-common/lib/middleware/request";
import { getServiceDir } from "../config/services";
import { incrementRetagFailures } from "./monitors/retagFailures";
import { isProduction } from "../lib/environment";
import { updateCronJobs } from "../lib/cronjobs";
import { updateService } from "../actions/bindersenv/service";
import { v4 } from "uuid";

const retagQueue = [];
let busyRetagging = false;

class DevopsService implements DevopsServiceContract {

    constructor(private logger: Logger, private readonly featureFlagService: IFeatureFlagService) {

    }

    async getDeployments(): Promise<ServiceDeployment[]> {
        const namespace = this.getNamespace()
        try {
            return await getK8sDeployments(namespace);
        } catch (ex) {
            this.logger.error(
                `Could not fetch deployments on namespace: ${namespace}`,
                "fetch-k8s-deployments",
                {
                    output: ex.output,
                    message: ex.message,
                    stack: ex.stack
                }
            );
            return [];
        }
    }

    private async processRetagQueue() {
        busyRetagging = true;
        try {
            const [currentTag, newTag, imageName, branchTag] = retagQueue.shift();
            let sourceTag = currentTag;
            try {
                await pullImage(currentTag);
            } catch (ex) {
                if (ex.message.indexOf("manifest unknown") === -1) {
                    throw ex;
                }
                console.log(`Could fetch image ${currentTag}, retrying with branch-tag`);
                sourceTag = branchTag;
                await pullImage(branchTag);
            }
            await tagImage(sourceTag, newTag);
            await pushImage(newTag);
            this.logger.info(`Successfully retagged image ${imageName}`, "devops-arc");
        } catch (err) {
            const originalError = err.originalError && ` - ${err.originalError.message}`;
            this.logger.error(`Could not retag image: ${err.output || err.message} ${originalError}`, "devops-arc");
            incrementRetagFailures();
        }
        finally {
            busyRetagging = false;
            if (retagQueue.length > 0) {
                this.processRetagQueue();
            }
        }
    }

    async retagImageLatest(spec: IServiceSpec, deployment: DeploymentDescriptor) {
        try {
            const imageName = getServiceDir(spec);
            const currentTag = getCommitTag(imageName, deployment.commitRef);
            const newTag = getCommitTag(imageName, "latest");
            const branchTag = getCommitTag(imageName, deployment.branch);
            retagQueue.push([currentTag, newTag, imageName, branchTag]);
            if (!busyRetagging) {
                this.processRetagQueue();
            }
        } catch (ex) {
            this.logger.error(
                "Could not retag image",
                "devops-acr",
                {
                    output: ex.output,
                    message: ex.message,
                    stack: ex.stack
                }
            );
        }
    }

    async deployService(spec: IServiceSpec, deployment: DeploymentDescriptor, deploymentGroupId?: string, groupDeploy = false): Promise<ServiceDeployment> {
        const bindersEnv: IBindersEnvironment = {
            ...deployment,
            isProduction: true,
            services: [spec],
            prefix: deployment.branch
        };
        await updateService(bindersEnv, spec.name, spec.version, deploymentGroupId);
        if (!groupDeploy) {
            await updateCronJobs(spec, deployment.branch)
        }
        const allDeploys = await this.getDeployments();
        return allDeploys.find(d => d.spec.name === spec.name && d.spec.version === spec.version);
    }

    async deleteDeployment(spec: IServiceSpec, deployDescriptor: DeploymentDescriptor): Promise<void> {
        const deployments = await this.getDeployments()
        const serviceDeploy = deployments.find(d => d.spec.name === spec.name && d.spec.version === spec.version)
        if(this.isActiveDeployment(deployDescriptor, serviceDeploy)) {
            throw new InvalidArgument(`Can't delete current active deployment! Deployment descriptor: ${deployDescriptor.branch}-${deployDescriptor.commitRef}`)
        }
        const namespace = this.getNamespace()
        await deleteK8sDeployment(spec, deployDescriptor, namespace);
    }

    async deployGroup(items: DeploymentGroupItem[]): Promise<DeployedGroup> {
        const groupId = `dgid-${v4()}`;
        const groupItems = [];
        for (const item of items) {
            const groupItem = await this.deployService(item.spec, item.deployment, groupId, true)
            groupItems.push(groupItem);
        }
        for (const item of items) {
            await updateCronJobs(item.spec, item.deployment.branch)
        }
        return {
            groupId,
            items: groupItems
        };
    }

    async getAllLaunchDarklyFlags(): Promise<{ [key: string]: unknown }> {
        return this.featureFlagService.getAllFlags()
    }

    async tempLog(msg: string) {
        console.log("\n", "\x1b[38;5;17;48;5;214m", "🛠️ ", msg, "\x1b[0m", "\n")
    }

    private isActiveDeployment(deploymentDescriptor: DeploymentDescriptor, serviceDeploy: ServiceDeployment): boolean {
        const activeDeployment = serviceDeploy.activeDeployment
        return activeDeployment.branch === deploymentDescriptor.branch && activeDeployment.commitRef === deploymentDescriptor.commitRef
    }

    private getNamespace() {
        return isProduction() ? PRODUCTION_NAMESPACE : process.env.K8S_NAMESPACE
    }

}

export class DevopsServiceFactory {
    forRequest(request: WebRequest): DevopsService {
        return new DevopsService(request.logger, this.readonlyfeatureFlagSerice);
    }

    constructor(private readonlyfeatureFlagSerice: IFeatureFlagService) {}
}
