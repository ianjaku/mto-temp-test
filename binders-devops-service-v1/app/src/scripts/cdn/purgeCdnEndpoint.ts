import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { RESOURCE_GROUP, VIDEO_CDN, purgeCdnEndpoint } from "../../lib/cdn";
import { loadJSON } from "../../lib/json";
import { main } from "../../lib/program";
import { parseEnv } from "../../lib/environment"




export interface PurgeOption {
    env: string;
    contentPaths: string | undefined;
    fileContentPaths: string | undefined;
    contentPathsBatchSize: number | undefined
}

export const getEnvironmentOptions = (): PurgeOption => {
    const programDefinition: IProgramDefinition = {
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
        contentPaths: {
            long: "contnetPaths",
            short: "c",
            kind: OptionType.STRING,
            description: "contentPaths",
        },
        fileContentPaths: {
            long: "fileContentPaths",
            short: "f",
            kind: OptionType.STRING,
            description: "file that contains contentPaths as keys",
        },
        contentPathsBatchSize: {
            long: "contentPathsBatchSize",
            short: "b",
            kind: OptionType.INTEGER,
            description: "contentPathsBatchSize",
        }

    }
    const parser = new CommandLineParser("PurgeOption", programDefinition)
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as PurgeOption
}

const getContentPaths = async (options: PurgeOption) => {
    const { contentPaths, fileContentPaths } = options
    if (fileContentPaths) {
        const affectedContainersMap = await loadJSON(fileContentPaths)
        return Object.keys(affectedContainersMap).map(containerId => "/" + containerId + "/*");
    }
    if (contentPaths) {
        return [contentPaths];
    }

    throw new Error("Please specify content paths to pruge cdn")
}


const doIt = async () => {
    const envOptions = getEnvironmentOptions()
    const { env, contentPathsBatchSize } = envOptions
    const environment = parseEnv(env)

    const videoCdn = VIDEO_CDN[environment]
    const resourceGroup = RESOURCE_GROUP[environment]
    const choosenContentPaths = await getContentPaths(envOptions)

    if (choosenContentPaths.length === 0) {
        throw new Error("Missing content paths to pruge cdn")
    }

    const videoCdnEndpointName = videoCdn.endpointName
    const videoCdnProfileName = videoCdn.profileName
    if (contentPathsBatchSize) {
        while (choosenContentPaths.length > 0) {
            const contentPathsBatch = choosenContentPaths.splice(0, contentPathsBatchSize)
            await purgeCdnEndpoint(contentPathsBatch, videoCdnEndpointName, videoCdnProfileName, resourceGroup)
        }
    } else {
        await purgeCdnEndpoint(choosenContentPaths, videoCdnEndpointName, videoCdnProfileName, resourceGroup)
    }

};

main(doIt);