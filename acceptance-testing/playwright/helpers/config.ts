
import { readFile, realpath, writeFile } from "fs/promises";
import { exec } from "child_process";
import { join } from "path";

export async function run(command: string): Promise<string> {
    return new Promise( (resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                return reject(err);
            }
            return resolve(`${stdout}${stderr}`);
        })
    })
}

async function loadJSON(localPath: string): Promise<Record<string, unknown>> {
    const contents = await readFile(localPath);
    return JSON.parse(contents.toString());
}

async function dumpJSON(contents: unknown, localPath: string): Promise<void> {
    const encoded = JSON.stringify(contents, null, 4);
    await writeFile(localPath, encoded);
}

interface ServiceLocations {
    editor: string;
    reader: string;
}
async function updateLocalConfigFile(localFile: string): Promise<ServiceLocations> {
    const config = await loadJSON(localFile);
    const services = Object.keys(config.services);
    for (const service of services) {
        config.services[service].location = config.services[service].externalLocation;
    }
    for (const redisdb of Object.keys(config.redis)) {
        config.redis[redisdb].host = "localhost";
        config.redis[redisdb].port = 30379;
    }
    await dumpJSON(config, localFile);
    return {
        editor: config.services["editor"].location,
        reader: config.services["manualto"].location
    };
}


async function copyConfigToAcceptance(localFile: string): Promise<void> {
    const acceptanceLocation = join(await realpath("./config/"), "development.json");
    await run(`cp ${localFile} ${acceptanceLocation}`);
}

async function updateServiceLocations(locations: ServiceLocations): Promise<void> {
    await dumpJSON(locations, join(await realpath("./config/"), "serviceLocations.json"));
}

export async function updateConfig(localFile: string): Promise<void> {
    const locations = await updateLocalConfigFile(localFile);
    await copyConfigToAcceptance(localFile);
    await updateServiceLocations(locations);
}