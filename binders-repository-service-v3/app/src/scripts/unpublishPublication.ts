/* eslint-disable no-console */
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BinderRepositoryServiceClient } from "@binders/client/lib/clients/repositoryservice/v3/client";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticPublicationsRepository } from "../repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const getOptions = () => {
    let publicationId;
    if (process.argv.length === 3) {
        publicationId = process.argv[2];
    } else {
        console.error("Please provide an publication ID.");
        process.exit(1);
    }
    return {
        publicationId
    };
};


const config = BindersConfig.get();

const logger = LoggerBuilder.fromConfig(config);
const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);

const getPublicationRepository = () => {
    return new ElasticPublicationsRepository(
        config, logger, queryBuilderHelper
    );
};


(async () => {
    const [repoClient] = await Promise.all([
        BackendRepoServiceClient.fromConfig(config, "unpublishPublication"),
    ]);
    const { publicationId } = getOptions();
    await setIsActrive2False(publicationId, repoClient);
    console.log(`All done for publication ${publicationId}`);
})();


// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setIsActrive2False = async (publicationId: string, repoClient: BinderRepositoryServiceClient) => {
    const publicationRepository = getPublicationRepository();
    const publicationObject = await publicationRepository.getPublication(publicationId);
    const notActive = {...publicationObject, isActive: false};
    try {
        await publicationRepository.save(notActive);
    } catch(ex) {
        console.log("Problem with saving publication!", ex);
    }
}