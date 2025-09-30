import { pullImage, tagImage, toRemoteDevImageTag } from "../../actions/docker/build";
import { getServiceDevImage } from "../../lib/devenvironment";
import { getServicesToBuild } from "../../actions/localdev/build";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { sequential } from "../../lib/promises";

const doIt = async() => {
    const servicesToBuild = getServicesToBuild();
    const localImageTags = [
        "client", "ui-kit", "common",
        ...servicesToBuild.map(service => getServiceDevImage(service))
    ];
    await sequential(
        async (localImageTag) => {
            const remoteImageTag = toRemoteDevImageTag(localImageTag);
            log(`Pulling image ${remoteImageTag}`);
            await pullImage(remoteImageTag);
            log(`Retagging ${remoteImageTag} -> ${localImageTag}`);
            await tagImage(remoteImageTag, localImageTag);
        },
        localImageTags
    );
}

main(doIt);