import { DEFAULT_BUILD_IMAGE_VERSION, buildImage, getDevopsDockerImageTag, pushImage } from "../../actions/docker/build";
import { getLocalRepositoryRoot } from "../../actions/git/local";
import log from "../../lib/logging";
import { main } from "../../lib/program";

const doIt = async () => {
    const image = "binders-devops";
    const dockerFile = "Dockerfile.devops";
    const repoRoot = await getLocalRepositoryRoot();
    const dockerDir = `${repoRoot}/binders-devops-service-v1/app/docker`;
    const context = `${repoRoot}/binders-devops-service-v1/app`;
    const fullTag = getDevopsDockerImageTag();
    log(`Building ${image}:${fullTag}`);
    const buildArgs = {
        SHARED_BUILD_COMMIT: "5ed6ad1d",
        BUILD_IMAGE_VERSION: DEFAULT_BUILD_IMAGE_VERSION
    };
    await buildImage(fullTag, `${dockerDir}/${dockerFile}`, context, buildArgs);
    await pushImage(fullTag);
};

main(doIt);