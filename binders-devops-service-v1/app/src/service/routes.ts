import { Allow } from "@binders/binders-service-common/lib/middleware/authorization";
import { ApplicationToken } from "@binders/binders-service-common/lib/middleware/authentication";
import {
    AuthorizationServiceContract
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { DevopsServiceContract } from "@binders/client/lib/clients/devopsservice/v1/contract";
import { DevopsServiceFactory } from "./service";
import { Logger } from "@binders/binders-service-common/lib/util/logging";
import { ServiceRoute } from "@binders/binders-service-common/lib/middleware/app";
import { getRoutes } from "@binders/client/lib/clients/devopsservice/v1/routes";

export function getServiceRoutes(logger: Logger, azClient: AuthorizationServiceContract, serviceFactory: DevopsServiceFactory): { [name in keyof DevopsServiceContract]: ServiceRoute } {
    const appRoutes = getRoutes();
    return {
        getDeployments: {
            ...appRoutes.getDeployments,
            serviceMethod: request => serviceFactory.forRequest(request).getDeployments(),
        },
        deployService: {
            ...appRoutes.deployService,
            serviceMethod: request => (
                serviceFactory.forRequest(request).deployService(request.body.serviceSpec, request.body.deployment, request.body.deploymentGroupId)
            ),
        },
        deleteDeployment: {
            ...appRoutes.deleteDeployment,
            serviceMethod: request => (
                serviceFactory.forRequest(request).deleteDeployment(request.body.serviceSpec, request.body.deployment)
            ),
        },
        deployGroup: {
            ...appRoutes.deployGroup,
            serviceMethod: request => (
                serviceFactory.forRequest(request).deployGroup(request.body.items)
            ),
        },
        getAllLaunchDarklyFlags: {
            ...appRoutes.getAllLaunchDarklyFlags,
            serviceMethod: request => (serviceFactory.forRequest(request).getAllLaunchDarklyFlags())
        },
        tempLog: {
            ...appRoutes.tempLog,
            serviceMethod: request => (
                serviceFactory.forRequest(request).tempLog(request.body.msg)
            ),
            authentication: ApplicationToken,
            authorization: Allow,
        }
    };
}