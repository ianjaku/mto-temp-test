import { pushImage, tagImage, toRemoteDevImageTag } from "../../actions/docker/build";
import { getServiceDevImage } from "../../lib/devenvironment";
import { getServicesToBuild } from "../../actions/localdev/build";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { sequential } from "../../lib/promises";

const doIt = async () => {
    const servicesToBuild = getServicesToBuild();
    const localImageTags = [
        "client", "ui-kit", "common",
        ...servicesToBuild.map(service => getServiceDevImage(service))
    ];
    await sequential(
        async (localTag) => {
            const remoteTag = toRemoteDevImageTag(localTag);
            log(`Retagging image ${localTag} -> ${remoteTag}`);
            await tagImage(localTag, remoteTag);
            log(`Pushing ${remoteTag}`)
            await pushImage(remoteTag);
        },
        localImageTags
    )
}

main(doIt);