/* eslint-disable no-console */
import { BackendAccountServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const SCRIPT_NAME = "add-language-code-to-chunks";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);
const BINDER_BATCH_SIZE = 100;

async function doIt() {
    const accClient = await BackendAccountServiceClient.fromConfig(config, SCRIPT_NAME);
    const accounts = await accClient.findAccounts({});
    logger.info(`+ Updating binders for ${accounts.length} accounts`, SCRIPT_NAME);
    for (let i = 0; i < accounts.length; i++) {
        const account = accounts[i];
        logger.info(`+ [${i+1}/${accounts.length}] Updating binders for ${account.name}`, SCRIPT_NAME);

        await scrollThroughAllBinders(account.id, async (esHits, repo) => {
            const updatedHits = esHits
                .map(hit => repo.binderWithLanguageCodesFromEsHit(hit))
                .filter(h => !!h);
            await repo.bulk(updatedHits, [], false);
        });
    }
}

async function scrollThroughAllBinders(
    accountId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback: (esHits: any[], repo: ElasticBindersRepository) => Promise<void>
) {
    const repo = new ElasticBindersRepository(
        config,
        logger,
        new DefaultESQueryBuilderHelper(config)
    );
    const query = {
        index: repo.getIndexName(),
        body: {
            query: {
                term: {
                    accountId
                }
            },
        }
    }
    await repo.runScroll(query, 3600, BINDER_BATCH_SIZE, (esHits) => callback(esHits, repo));
}

doIt()
    .then(() => {
        console.log(`
----------------------------------------------------
          Finished with great success!
----------------------------------------------------
`);
        process.exit(0);
    })
    .catch((err) => {
        console.log("Forgive me, for I have failed:", err);
        process.exit(1);
    });

