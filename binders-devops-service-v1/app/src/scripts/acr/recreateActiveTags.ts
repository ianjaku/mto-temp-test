import { BINDERS_SERVICE_SPECS, IServiceSpec, getServiceDir } from "../../config/services";
import { PRODUCTION_NAMESPACE, toServiceName } from "../../lib/bindersenvironment";
import { getCommitTag, pullImage, pushImage, tagImage } from "../../actions/docker/build";
import { getActiveServiceTags } from "../../actions/bindersenv/deployment";
import { log } from "console";
import { main } from "../../lib/program";

async function retagService(spec: IServiceSpec, tag: string) {
    const imageName = getServiceDir(spec);
    log(`Processing service ${imageName}`)
    const currentTag = getCommitTag(imageName, "latest")
    const newTag = getCommitTag(imageName, tag)

    try {
        try {
            await pullImage(currentTag);
        } catch (ex) {
            if (ex.message.indexOf("manifest unknown") === -1) {
                throw ex;
            }
        }
        await tagImage(currentTag, newTag);
        await pushImage(newTag);
        log(`Successfully retagged image ${imageName}`, "devops-arc");
    } catch (err) {
        const originalError = err.originalError && ` - ${err.originalError.message}`;
        log(`Could not retag image: ${err.output || err.message} ${originalError}`, "devops-arc");
    }
}

async function recreateActiveTags() {
    const activeServiceTags = await getActiveServiceTags(PRODUCTION_NAMESPACE)
    const servicesSpecs = BINDERS_SERVICE_SPECS.filter(spec => !spec.sharedDeployment)
    for (const spec of servicesSpecs) {
        const tag = activeServiceTags[toServiceName(spec)]
        await retagService(spec, tag)
    }
}

const doIt = async () => {
    await recreateActiveTags()
}

main(doIt)