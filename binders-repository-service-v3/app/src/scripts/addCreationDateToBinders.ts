/* eslint-disable no-console */
import { Binder } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";

const config = BindersConfig.get();
const logger = LoggerBuilder.fromConfig(config);

const addCreationDateToBinders = async () => {
    const binderRepo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));

    await binderRepo.runScroll({
        index: [binderRepo.getIndexName()],
        body: {
            query: {
                bool: {
                    must_not: [
                        {
                            exists: {
                                field: "created"
                            }
                        }
                    ]
                }
            }
        }
    }, 1000, 100, async (esHits: {_source: Binder, _id: string}[]) => {

        const updatedBinders: Binder[] = [];

        for (const hit of esHits) {
            const binder = {
                ...hit._source,
                id: hit._id
            } as Binder;

            const oldestBinderLogCreationDate = binder.binderLog.current.reduce<Date>((oldest, log) => {
                if (oldest == null) return new Date(log.createdAt);
                if (new Date(log.createdAt).getTime() < oldest.getTime()) return new Date();
                return oldest;
            }, null);

            updatedBinders.push({
                ...binder,
                created: oldestBinderLogCreationDate
            });
        }

        await binderRepo.bulk(updatedBinders, []);
    });
}

addCreationDateToBinders()
    .then(() => console.log("Finished"))
    .catch(e => console.log("Whoops, ", e))
