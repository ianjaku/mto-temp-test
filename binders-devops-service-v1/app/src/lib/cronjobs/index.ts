import { IBindersEnvironment, toDeploymentName } from "../bindersenvironment";
import { ICronjobDefinition, buildCronJob } from "../../actions/k8s/cronjob";
import { IServiceSpec } from "@binders/client/lib/clients/devopsservice/v1/contract";
import { createAccountCronjobs } from "./account";
import { createBindersCronjobs } from "./binders";
import { createCredentialCronjobs } from "./credential";
import { createDevopsCronjobs } from "./devops";
import { createImageCronjobs } from "./image";
import { createNotificationCronjobs } from "./notification";
import { createTrackingCronjobs } from "./tracking";
import { createUserCronjobs } from "./user";
import { dumpAndRunKubeCtl } from "../k8s";
import { getDeployment } from "../../actions/k8s/deployments";
import { getDeployments } from "../../actions/bindersenv/deployment";
import { log } from "../logging";


export const createJob = async (definition: ICronjobDefinition, name: string): Promise<void> => {
    const job = buildCronJob(definition);
    await dumpAndRunKubeCtl(job, name, false);
}


export async function updateCronJobs(spec: IServiceSpec, branch: string): Promise<void> {
    switch (spec.name) {
        case "account":
            await createAccountCronjobs(branch);
            break;
        case "binders":
            await createBindersCronjobs(branch)
            break
        case "credential":
            await createCredentialCronjobs(branch);
            break;
        case "devops":
            await createDevopsCronjobs(branch)
            break;
        case "image":
            await createImageCronjobs(branch)
            break;
        case "notification":
            await createNotificationCronjobs(branch)
            break;
        case "tracking":
            await createTrackingCronjobs(branch)
            break;
        case "user":
            await createUserCronjobs(branch)
            break;
        default:
            log(`Service ${spec.name} don't have any cronjobs`)
    }
}

export async function getRecentImageTag(serviceName: string, namespace: string): Promise<string> {
    const deploys = await getDeployments(namespace)
    const deploy = deploys.find(deploy => deploy.spec.name === serviceName)
    const env: IBindersEnvironment = {
        branch: deploy.activeDeployment.branch,
        commitRef: deploy.activeDeployment.commitRef,
        // dummy values just for reusing toDeploymentName logic
        isProduction: true,
        services: [deploy.spec],
        prefix: deploy.activeDeployment.branch
    }
    const name = toDeploymentName(env, deploy.spec)
    return extractTagFromDeployment(name, namespace)

}
async function extractTagFromDeployment(name: string, namespace: string) {
    const dep = await getDeployment(name, namespace)
    const image = dep?.spec?.template?.spec?.containers[0].image as string
    return image.split(":")[1]
}