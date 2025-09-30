import * as HTTPStatusCode from "http-status-codes";
import {AppRoute, HTTPVerb} from "../../routes";
import { DevopsServiceContract } from "./contract";

export function getRoutes(): { [name in keyof DevopsServiceContract]: AppRoute } {
    return {
        deleteDeployment: {
            description: "Delete the provided deploy candidate",
            path: "/deployments",
            verb: HTTPVerb.DELETE,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        deployGroup: {
            description: "Deploy a group of services",
            path: "/deploymentgroups",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        tempLog: {
            description: "temporary log a message for debugging purposes",
            path: "/templog",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        deployService: {
            description: "Update the given k8s service so it uses the provided deployment",
            path: "/services",
            verb: HTTPVerb.POST,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getDeployments: {
            description: "Get the k8s production deployments",
            path: "/deployments",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        },
        getAllLaunchDarklyFlags: {
            description: "Get all launch darkly flags",
            path: "/ldFlags",
            verb: HTTPVerb.GET,
            validationRules: [],
            successStatus: HTTPStatusCode.OK
        }
    };
}