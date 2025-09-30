import * as elastic from "@elastic/elasticsearch";
import { ProductionClusterBackupConfig } from "../../lib/bindersconfig";
import { log } from "../../lib/logging";

export const hasRepository = async (client: elastic.Client, repositoryName: string): Promise<boolean> => {
    try {
        log("getting repository")
        const r = await client.snapshot.getRepository({ repository: repositoryName });
        return r.statusCode === 200;
    } catch (err) {
        log(`${err}`)
        if (err.statusCode === 404) {
            return false;
        }
        throw err;
    }
};


export const addRepository = async (client: elastic.Client, backupConfig: ProductionClusterBackupConfig): Promise<void> => {
    const { repositoryName, repositoryOptions, repositoryType } = backupConfig;
    await client.snapshot.createRepository({
        repository: repositoryName,
        body: {
            type: repositoryType,
            settings: repositoryOptions
        }
    });
};