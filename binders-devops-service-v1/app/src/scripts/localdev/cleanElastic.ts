import { deleteElasticsearchCluster, deleteKibana } from "../../actions/elastic/eck";
import { SNAPSHOT_CREDENTIALS_SECRET } from "../../lib/eck";
import { deleteSecret } from "../../actions/k8s/secrets";
import log from "../../lib/logging";
import { main } from "../../lib/program";

const NAMESPACE = "develop"

const cleanupEck = async () => {
    try {
        await deleteElasticsearchCluster("binders", NAMESPACE)
        await deleteKibana("kibana-binders", NAMESPACE)
    } catch (error) {
        if (error?.output?.indexOf("the server doesn't have a resource type") === -1) {
            throw error;
        }
        return;
    }
    try {
        await deleteSecret(SNAPSHOT_CREDENTIALS_SECRET, NAMESPACE);
    } catch (error) {
        log(error)
    }

}

const doIt = async (): Promise<void> => {
    await cleanupEck();
}

main(doIt)