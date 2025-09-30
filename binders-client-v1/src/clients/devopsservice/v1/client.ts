import { BindersServiceClient, RequestHandler } from "../../client";
import {
    DeployedGroup,
    DeploymentDescriptor,
    DeploymentGroupItem,
    DevopsServiceContract,
    IServiceSpec,
    ServiceDeployment
} from "./contract";
import { BindersServiceClientConfig } from "../../config";
import { Config } from "../../../config";
import { getRoutes } from "./routes";

export class DevopsServiceClient extends BindersServiceClient implements DevopsServiceContract {

    constructor(endpointPrefix: string, requestHandler: RequestHandler) {
        super(endpointPrefix, getRoutes(), requestHandler);
    }

    static fromConfig(
        config: Config,
        version: string,
        requestHandler: RequestHandler
    ): DevopsServiceClient {
        const versionedPath = BindersServiceClientConfig.getVersionedPath(config, "devops", version);
        return new DevopsServiceClient(versionedPath, requestHandler);
    }

    getDeployments(): Promise<ServiceDeployment[]> {
        return this.handleRequest("getDeployments", {});
    }

    deployService(serviceSpec: IServiceSpec, deployment: DeploymentDescriptor): Promise<ServiceDeployment> {
        return this.handleRequest("deployService", {
            body: {
                serviceSpec,
                deployment
            }
        });
    }

    deleteDeployment(serviceSpec: IServiceSpec, deployment: DeploymentDescriptor): Promise<void> {
        return this.handleRequest("deleteDeployment", {
            body: {
                serviceSpec,
                deployment
            }
        });
    }

    deployGroup(items: DeploymentGroupItem[]): Promise<DeployedGroup> {
        return this.handleRequest("deployGroup", {
            body: {
                items
            }
        });
    }

    getAllLaunchDarklyFlags(): Promise<{ [key: string]: unknown }> {
        return this.handleRequest("getAllLaunchDarklyFlags", {})
    }

    tempLog(msg: string): Promise<void> {
        return this.handleRequest("tempLog", {
            body: {
                msg
            }
        });
    }
}