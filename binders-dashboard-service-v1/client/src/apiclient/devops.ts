import {
    DeployedGroup,
    DeploymentDescriptor,
    DeploymentGroupItem,
    IServiceSpec,
    ServiceDeployment
} from "@binders/client/lib/clients/devopsservice/v1/contract";
import { DevopsServiceClient } from "@binders/client/lib/clients/devopsservice/v1/client";
import config from "../config";
import { getBackendRequestHandler } from "../modules/api";

const backendDevopsClient = DevopsServiceClient.fromConfig(config, "v1", getBackendRequestHandler());

export const APILoadDeployments = (): Promise<ServiceDeployment[]> => (
    backendDevopsClient.getDeployments()
);

export const APIRunDeploy = (spec: IServiceSpec, deploy: DeploymentDescriptor):Promise<ServiceDeployment> => backendDevopsClient.deployService(spec, deploy);

export const APIRunGroupDeploy = (items: DeploymentGroupItem[]): Promise<DeployedGroup> => backendDevopsClient.deployGroup(items);

export const APIDeleteDeploy = (spec: IServiceSpec, deploy: DeploymentDescriptor): Promise<void> => backendDevopsClient.deleteDeployment(spec, deploy)

export const APIGetAllLaunchDarklyFlags = (): Promise<{ [key: string]: unknown }> => (backendDevopsClient.getAllLaunchDarklyFlags())