
import * as hubspot from "@hubspot/api-client";
import { HubspotDeal, HubspotDealHistory, calculateWeightedAmount, loadHistories } from "./deal";
import { add } from "date-fns";
import { writeFile } from "fs/promises";

interface APIPage<T> {
    paging?: {
        next?: {
            after?: string;
        }
    },
    results: T[];
}

const cachedOwners = {};
const cachedDealStages = {};

export class HubspotAPIClient {

    constructor(private readonly token: string) {

    }

    async getDeals(): Promise<HubspotDeal[]> {
        const client = this.buildClient();
        const properties = HubspotDeal.apiProperties();
        const fetchPage = after => (
            client.crm.deals.basicApi.getPage(
                50, after, properties,
            )
        );
        const mapObject = async (apiObject) => {
            const deal = HubspotDeal.fromAPIResult(apiObject);
            deal.owner = await this.resolveOwner(deal.ownerId);
            deal.dealstage = await this.resolveDealStage(deal.dealstageId);
            return deal;
        }
        return this.processAllPages(fetchPage, mapObject);
    }

    async getPipelineHistory(): Promise<HubspotDealHistory[]> {
        const client = this.buildClient();
        const properties = HubspotDeal.apiProperties();
        const fetchPage = after => (
            client.crm.deals.basicApi.getPage(
                50, after, properties, properties
            )
        );
        const mapObject = async (apiObject) => {
            const dealStageMapper = this.resolveDealStage.bind(this);
            const ownerMapper = this.resolveOwner.bind(this);
            const mappers = {
                dealStageMapper,
                ownerMapper
            };
            return HubspotDealHistory.fromDealsAPIResult(apiObject, mappers);
        }
        return this.processAllPages(fetchPage, mapObject);
    }

    private async resolveOwner(ownerId: number): Promise<string> {
        if (!cachedOwners[ownerId]) {
            const client = this.buildClient();
            try {
                const owner = await client.crm.owners.ownersApi.getById(ownerId);
                cachedOwners[ownerId] = owner.firstName + " " + owner.lastName;
            } catch (e) {
                // eslint-disable-next-line no-console
                // console.error("Error fetching owner", e);
                cachedOwners[ownerId] = "Unknown";
            }
        }
        return cachedOwners[ownerId];
    }

    private async resolveDealStage(dealstageId: number): Promise<string> {
        if (!cachedDealStages[dealstageId]) {
            const client = this.buildClient();
            try {
                const dealstages = await client.crm.pipelines.pipelinesApi.getAll("deals");
                for (const pipeline of dealstages.results) {
                    pipeline.stages.forEach(stage => {
                        const stageId = Number.parseInt(stage.id);
                        cachedDealStages[stageId] = stage.label;
                    });
                }
            } catch (e) {
                // eslint-disable-next-line no-console
                // console.error("Error fetching deal stages", e);
                cachedDealStages[dealstageId] = "Unknown";
            }
        }
        return cachedDealStages[dealstageId];
    }

    private async processAllPages<APIObject, MappedObject> (
        fetchPage: (after: string) => Promise<APIPage<APIObject>>,
        mapObject: (apiObject: APIObject) => Promise<MappedObject>,
    ): Promise<MappedObject[]> {
        let after = "0";
        const results: MappedObject[] = [];
        do {
            const page = await fetchPage(after);
            for (const apiObject of page.results) {
                const mapped = await mapObject(apiObject);
                if (mapped) {
                    results.push(mapped);
                }
            }
            if (page?.paging?.next?.after) {
                after = page.paging.next.after;
            } else {
                after = undefined;
            }
            // Shortcut the paging for testing
            // after = undefined;
        } while (after !== undefined);
        return results;
    }


    private buildClient(): hubspot.Client {
        return new hubspot.Client({
            accessToken: this.token
        })
    }
}

/* eslint-disable no-console */
async function doIt() {
    // const client = new HubspotAPIClient(process.env.HUBSPOT_API_KEY);
    // console.log("Getting history.");
    // const histories1 = await client.getPipelineHistory();
    const dumpFile = "/tmp/hubspot-history.json";
    // await dumpHistories(dumpFile, histories1);
    const histories = await loadHistories(dumpFile);
    const doCalculation = (histories, snapshotDate, foreCastMonth) => {
        const dealSnapshots = [];
        for (const history of histories) {
            const dealSnapshot = history.snapshotAt(snapshotDate);
            if (dealSnapshot) {
                dealSnapshots.push(dealSnapshot);
            }
        }
        return calculateWeightedAmount(dealSnapshots, foreCastMonth);
    }
    // console.log("H1", histories1.length);
    // console.log("H2", histories2.length);
    // doCalculation(histories1);
    const csvLines = ["Snapshot,Forecast,Amount"];
    const jan1st = new Date("2024-01-01");
    for (let i=0; i<12; i++) {
        const snapshotDate = add(jan1st, { months: i + 1 });
        for (let j=0; j<12; j++) {
            const foreCastMonth = add(jan1st, { months: j });
            const amount = doCalculation(histories, snapshotDate, foreCastMonth);
            console.log("Snapshot", snapshotDate, "Forecast", foreCastMonth, "Amount", amount);
            csvLines.push(`${snapshotDate.toISOString()},${foreCastMonth.toISOString()},${amount}`);
        }
        console.log("\n----\n");
    }
    await writeFile("/tmp/hubspot-forecast.csv", csvLines.join("\n"));

}

doIt()
    .then(
        () => {
            console.log("done");
            process.exit(0);
        },
        err => {
            console.error(err);
            process.exit(1);
        }
    )