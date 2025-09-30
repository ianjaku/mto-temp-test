import * as path from "path"
import { existsSync } from "fs";

function getAppBaseDir() {
    const pathToRoot = path.resolve(__dirname).split(path.sep);
    const appDirIndex = pathToRoot.lastIndexOf("app");
    if (appDirIndex === -1) throw new Error(`'app' directory not in path: ${__dirname}`);
    return pathToRoot.slice(0, appDirIndex + 1).join(path.sep);
}

function getHelmBaseDir() {
    const helmBaseDir = path.join(getAppBaseDir(), "helm");
    if (!existsSync(helmBaseDir)) throw new Error(`'helm' directory does not exist at: ${helmBaseDir}`);
    return helmBaseDir;
}

export const HELM_BASE_DIR = getHelmBaseDir();
export const HELM_PRODUCTION_INFRASTRUCTURE_DIR = HELM_BASE_DIR + "/production_infrastructure";
export const HELM_PRODUCTION_ELASTIC_DIR = HELM_PRODUCTION_INFRASTRUCTURE_DIR + "/elastic";
export const HELM_PRODUCTION_ELASTIC_MANAGEMENT_DIR = HELM_PRODUCTION_ELASTIC_DIR + "/management";
export const HELM_PRODUCTION_ELASTIC_SETUP_DIR = HELM_PRODUCTION_ELASTIC_DIR + "/setup";
export const HELM_PRODUCTION_ELASTIC_SERVICE_DIR = HELM_PRODUCTION_ELASTIC_DIR + "/service";
export const HELM_PRODUCTION_ELASTIC_LOGGING_DIR = HELM_PRODUCTION_ELASTIC_DIR + "/logging";
export const HELM_PRODUCTION_MONGO_DIR = HELM_PRODUCTION_INFRASTRUCTURE_DIR + "/mongo";
export const HELM_PRODUCTION_MONGO_MANAGEMENT_DIR = HELM_PRODUCTION_MONGO_DIR + "/management";
export const HELM_PRODUCTION_MONGO_SETUP_DIR = HELM_PRODUCTION_MONGO_DIR + "/setup";
export const HELM_PRODUCTION_MONGO_SERVICE_DIR = HELM_PRODUCTION_MONGO_DIR + "/service";
export const HELM_PRODUCTION_MONGO_SERVICE__STATIC_PV_DIR = HELM_PRODUCTION_MONGO_DIR + "/service_static_pv";
export const HELM_PRODUCTION_MONITORING_DIR = HELM_PRODUCTION_INFRASTRUCTURE_DIR + "/monitoring";
export const HELM_STAGING_INFRASTRUCTURE_DIR = HELM_BASE_DIR + "/staging_infrastructure";
export const HELM_STAGING_REDIS_DIR = HELM_STAGING_INFRASTRUCTURE_DIR + "/redis";
export const HELM_STAGING_MONGO_DIR = HELM_STAGING_INFRASTRUCTURE_DIR + "/mongo";
export const HELM_STAGING_MONGO_STATIC_PV_DIR = HELM_STAGING_INFRASTRUCTURE_DIR + "/mongo_static_pv";


