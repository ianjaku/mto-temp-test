/* eslint-disable no-console */
import {
    BackendRepoServiceClient,
    BackendRoutingServiceClient,
    BackendTrackingServiceClient
} from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CollectionElement } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { Command } from "commander";
import { DEFAULT_COVER_IMAGE } from "@binders/client/lib/binders/defaults";
import Thumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import { differenceInDays } from "date-fns";
import { info } from "@binders/client/lib/util/cli";
import { main } from "@binders/binders-service-common/lib/util/process";

const SCRIPT_NAME = "archiveOldDocsInRoot";

type ScriptOptions = {
    domain: string;
    maxAge: number;
};


const program = new Command();

program
    .name(SCRIPT_NAME)
    .description("Archive all old unused documents in the root collection")
    .option("--domain [domain]", "Domain to process")
    .option("--maxAge [maxAge]", "Max age in days for a document to be considered old", 180);
    

function getOptions(): ScriptOptions {
    program.parse(process.argv);
    const stringOpts = program.opts();
    return {
        domain: stringOpts.domain,
        maxAge: Number.parseInt(stringOpts.maxAge, 10),
    };
}

const log = (msg = "") => info(msg);


async function getRepoClients() {
    const config = BindersConfig.get();
    return Promise.all([
        BackendRepoServiceClient.fromConfig(config, SCRIPT_NAME),
        BackendRoutingServiceClient.fromConfig(config, SCRIPT_NAME),
        BackendTrackingServiceClient.fromConfig(config, SCRIPT_NAME),
    ]);
}

main(async () => {
    const { domain, maxAge } = getOptions();
    if (!domain) {
        log("Domain is required");
        process.exit(1);
    }
    log(`Archiving old documents in root collection for domain ${domain} older than ${maxAge} days`);
    const [repoClient, routingClient, trackingClient] = await getRepoClients();
    const accountIds = await routingClient.getAccountIdsForDomain(domain);
    if(accountIds.length > 1) {
        log("More than one account found");
        process.exit(1);
    }
    const accountId = accountIds[0];
    const rootCollections = await repoClient.getRootCollections(accountIds);
    const rootCollection = rootCollections[0];
    const documentsInRootCollection = rootCollection.elements.filter(element => element.kind !== "collection");
    log(`Found ${documentsInRootCollection.length} documents in root collection (out of ${rootCollection.elements.length} elements)`);
    
    const elementsToMove: CollectionElement[] = [];
    const now = new Date();
    for (const document of documentsInRootCollection) {
        const binderId = document.key;
        const filter = {
            limitResults: 1,
            accountId,
            binderIds: [binderId],
        }
        const { userActions } = await trackingClient.findUserActions(filter);
        if (userActions.length === 0) {
            log(`Document ${binderId} has no user actions, will be moved to archive`);
            elementsToMove.push(document);
        } else {
            const { start: startStr } = userActions[0];
            const start = new Date(startStr);
            const ageInDays = differenceInDays(now, start);
            if (ageInDays <= maxAge) {
                log(`Skipping document ${binderId} as it has recent user actions (last activity ${ageInDays} days ago)`);
            } else {
                log(`Document ${binderId} has no recent user actions, will be moved to archive`);
                elementsToMove.push(document);
            }
        }
    }
    const thumbnail = { medium: DEFAULT_COVER_IMAGE, fitBehaviour: "fit", bgColor: "transparent" };
    const archiveCollection = await repoClient.createCollectionBackend(
        accountId,
        `Archive (${new Date().toDateString()})`,
        "en",
        thumbnail as Thumbnail,
        rootCollection.id
    );
    await repoClient.addElementToCollection(rootCollection.id, "collection", archiveCollection.id, accountId);
    log(`Created archive collection ${archiveCollection.id}`);

    const archiveCollectionId = archiveCollection.id;

    log(`Moving ${elementsToMove.length} documents to archive`);
    for (const element of elementsToMove) {
        log(`Moving document ${element.key} to archive`);
        await repoClient.addElementToCollection(archiveCollectionId, "document", element.key, accountId);
        await repoClient.removeElementFromCollection(rootCollection.id, "document", element.key, accountId, true);
    }
    log(`Moved ${elementsToMove.length} documents to archive`);
})