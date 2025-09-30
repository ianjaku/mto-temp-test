
const NODE_VERSION = 22;

const NODE_ALPINE = `node:${NODE_VERSION}-alpine`;
const NODE_ALPINE_VERSIONS = {
    build: NODE_ALPINE,
    runtime: NODE_ALPINE
};


const DEVOPS_IMAGE = "binders.azurecr.io/ubuntu-devops:node22-ts5.4";
const DEVOPS_VERSIONS = {
    build: DEVOPS_IMAGE,
    runtime: DEVOPS_IMAGE
};

const NODE_ALPINE_WKHTMLTOPDF_IMAGE = "surnet/alpine-node-wkhtmltopdf:22.17.0-0.12.6-full";
const NODE_ALPINE_WKHTMLTOPDF_VERSIONS = {
    build: NODE_ALPINE_WKHTMLTOPDF_IMAGE,
    runtime: NODE_ALPINE_WKHTMLTOPDF_IMAGE
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getNodeVersions (serviceFolder: string) {
    if (serviceFolder === "binders-devops-service-v1") {
        return DEVOPS_VERSIONS;
    }
    if (serviceFolder === "binders-repository-service-v3") {
        return NODE_ALPINE_WKHTMLTOPDF_VERSIONS;
    }
    return NODE_ALPINE_VERSIONS;
}
