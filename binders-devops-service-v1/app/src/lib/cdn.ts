import { buildAndRunCommand, buildAzCommand } from "./commands";

export const VIDEO_CDN = {
    "dev": {
        endpointName: "manualto-dev-videos-cdn",
        profileName: "manualto-dev-cdn-profile"
    },
    "production": {
        endpointName: "bindersmedia-videos",
        profileName: "bindersmedia-videos-cdn"
    }
}

export const IMAGE_CDN = {
    "dev": {
        endpointName: "manualto-dev-images-cdn",
        profileName: "manualto-dev-cdn-profile"
    },
    "production": {
        endpointName: "bindersmedia-visuals",
        profileName: "bindersmedia-visuals-cdn"
    }
}

export const RESOURCE_GROUP = {
    "dev": "manualto-dev-resource-group",
    "production": "media"
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const purgeCdnEndpoint = async (contentPaths: string[], endpointName, profileName, resourceGroup) => {
    const args = ["cdn", "endpoint", "purge", "--resource-group", resourceGroup, "--name", endpointName, "--profile-name", profileName, "--content-paths", ...contentPaths]
    return buildAndRunCommand(() => buildAzCommand(args))
}