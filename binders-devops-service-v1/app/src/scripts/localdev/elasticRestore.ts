import { buildBackupConfig, loadProductionSecrets } from "../../lib/bindersconfig";
import { getNewElasticClient } from "../../actions/elastic/config";
import { loadFile } from "../../lib/fs";
import { main } from "../../lib/program";
import { runLatestRestore } from "../../actions/elastic/devRestore";

const maybeGetCustomSnapshotName = () => {
    return process.argv.length > 2 ? process.argv[2] : undefined
};

const loadElasticPassword = async () => {
    return loadFile("/etc/elastic/elastic")
}

const getElasticClient = async () => {
    const esUserPassword = await loadElasticPassword()
    return getNewElasticClient(esUserPassword)
}

const doIt = async () => {
    const snapshot = maybeGetCustomSnapshotName()
    const client = await getElasticClient()
    const secrets = await loadProductionSecrets();
    const backupConfig = buildBackupConfig(secrets);
    await runLatestRestore(client, backupConfig.elastic["bindersAzure"], snapshot);
};
main(doIt);