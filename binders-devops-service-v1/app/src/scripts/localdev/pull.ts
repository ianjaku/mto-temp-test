import { getCommitTag, pullImage, tagImage } from "../../actions/docker/build";
import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { getCurrentBranch } from "../../actions/git/branches";
import { log } from "../../lib/logging";
import { main } from "../../lib/program";
import { sequential } from "../../lib/promises";

const getImagesOption = () => {
    const serviceOptions = BINDERS_SERVICE_SPECS
        .filter(s => (!s.sharedDeployment && s.name !== "static-pages") )
        .map(s => {
            const name = (s.name === "binders" ? "repository" : s.name);
            const prefix = (s.name === "manualto" ? "" : "binders-");
            return `${prefix}${name}-service-${s.version}`;
        });

    return [
        "binders-client",
        "binders-common",
        "binders-ui-kit",
        ...serviceOptions
    ];
};

const getBranchOption = () => getCurrentBranch();

const getOptions = async () => {

    return {
        branch: await getBranchOption(),
        images: getImagesOption()
    };
};

const mapImage = (toMap: string) => {
    const prefix = "binders-";
    const prefixStripped = toMap.startsWith(prefix) ?
        toMap.substr(prefix.length) :
        toMap;
    switch (prefixStripped) {
        case "common":
        case "ui-kit":
        case "client": {
            return prefixStripped;
        }
        case "repository-service-v3": {
            return "binders-v3";
        }
        default: {
            // "account-service-v1" => "account-v1"
            return prefixStripped.replace("service-", "");
        }
    }
};

const retagImage = async (branchTag: string) => {
    const noBranchTag = branchTag.split(":")[0];
    const noBranchNoHostTag = noBranchTag.split("/")[1];
    const mappedTag = mapImage(noBranchNoHostTag);
    return tagImage(branchTag, mappedTag);
};

const pullImages = async (branch: string, images: string[]) => {
    const imageTags = images.map(i => getCommitTag(i, branch));
    try {
        await sequential(pullImage, imageTags);
    } catch (err) {
        const message = err.output || err.message;
        if (message.indexOf("unauthorized") > -1) {
            log("You need to login to the docker registry\nPlease run this command:\n");
            log("\naz acr login --name binders -g docker-registry\n", "");
            process.exit(1);
        } else {
            throw err;
        }
    }
    return sequential(i => retagImage(i), imageTags);
};

const doIt = async () => {
    const { branch, images } = await getOptions();
    await pullImages(branch, images);
};

main(doIt);

