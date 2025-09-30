/* eslint-disable no-console */
import { endOfDay, startOfDay } from "date-fns";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { AkitaEventType } from "..";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../../repositoryservice/esquery/helper";
import {
    ElasticPublicationsRepository
} from "../../../repositoryservice/repositories/publicationrepository";
import { EventPartial } from "../akita";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";

export const getPublicationsCreatedEvents = async (
    account: Account,
    date: string // format yyyy-mm-dd
): Promise<EventPartial[]> => {
    const config = BindersConfig.get();
    const logger = LoggerBuilder.fromConfig(config);

    const publicationRepo = new ElasticPublicationsRepository(config, logger, new DefaultESQueryBuilderHelper(config));

    const publications = await publicationRepo.runSearch<Publication[]>(
        {
            index: publicationRepo.getIndexName(),
            body: {
                query: {
                    bool: {
                        must: [
                            {
                                term: {
                                    accountId: account.id
                                }
                            },
                            {
                                range: {
                                    publicationDate: {
                                        gte: startOfDay(new Date(date)).getTime(),
                                        lte: endOfDay(new Date(date)).getTime(),
                                    }
                                }
                            }
                        ]
                    }
                },
            },
        },
    );

    console.log(`         Found ${publications.length} publications created on ${date}`)

    const eventMap = publications.reduce((acc, publication) => {
        const manualtoUserId = publication.publishedBy || "public";
        const key = manualtoUserId;
        if (!acc[key]) {
            acc[key] = {
                manualtoUserId,
                event: AkitaEventType.DocumentPublished,
                event_date: date,
                event_count: 0,
            }
        }
        acc[key].event_count++;
        return acc;
    }, {} as { [key: string]: EventPartial });

    const events = Object.values(eventMap);
    return events;

}