import { isBefore, isEqual, isSameMonth } from "date-fns";
import { readFile, writeFile } from "fs/promises";

export interface IHubspotDeal {
    name: string;
    closeDate: Date;
    amount: number;
    weightedAmount: number;
    weight: number;
    ownerId: number;
    owner?: string;
    snapshotDate?: Date;
}

export type APIDealProperties =
    "dealname" |
    "amount" |
    "closedate" |
    "hubspot_owner_id" |
    "weight____" |
    "dealstage" |
    "pipeline";

function translateDealProperty(property: APIDealProperties): string {
    switch (property) {
        case "dealname":
            return "name";
        case "closedate":
            return "closeDate";
        case "hubspot_owner_id":
            return "ownerId";
        case "weight____":
            return "weight";
        case "dealstage":
            return "dealstageId";
        default:
            return property;
    }
}
export interface APIDeal {
    properties: Record<APIDealProperties, string>;
    propertiesWithHistory?: Record<APIDealProperties, string>;
}

const propertyMapper = {
    dealname: value => value,
    closedate: value => new Date(value),
    amount: value => Number.parseInt(value),
    weight____: value => Number.parseInt(value) / 100,
    pipeline: value => value,
    dealstage: value => Number.parseInt(value),
    hubspot_owner_id: value => Number.parseInt(value),
};

const dealStagesWon = ["Deal Won", "Closed won"];
const lostStagesWon = ["Deal Lost", "Closed lost"];

export class HubspotDeal implements IHubspotDeal {

    constructor(
        readonly name: string,
        readonly closeDate: Date,
        readonly amount: number,
        readonly weight: number,
        readonly pipeline: string,
        readonly dealstageId: number,
        readonly ownerId: number,
        public owner?: string,
        public dealstage?: string,
    ) {}

    get weightedAmount(): number {
        let weight;
        if (dealStagesWon.includes(this.dealstage)) {
            weight = 1;
        } else {
            if (lostStagesWon.includes(this.dealstage)) {
                weight = 0;
            } else {
                weight = this.weight || 0;
            }
        }
        return this.amount * weight;
    }

    static fromAPIResult(result: APIDeal): HubspotDeal {
        return new HubspotDeal(
            propertyMapper.dealname(result.properties.dealname),
            propertyMapper.closedate(result.properties.closedate),
            propertyMapper.amount(result.properties.amount),
            propertyMapper.weight____(result.properties.weight____),
            propertyMapper.pipeline(result.properties.pipeline),
            propertyMapper.dealstage(result.properties.dealstage),
            propertyMapper.hubspot_owner_id(result.properties.hubspot_owner_id)
        )
    }

    static apiProperties(): APIDealProperties[] {
        return Object.keys(propertyMapper) as APIDealProperties[];
    }
}

export async function dumpHistories(file: string, histories: HubspotDealHistory[]): Promise<void> {
    const serialized = JSON.stringify(histories, null, 2);
    await writeFile(file, serialized);
}

export async function loadHistories(file: string): Promise<HubspotDealHistory[]> {
    const serialized = await readFile(file, "utf-8");
    const deserialized = JSON.parse(serialized);
    const histories = [];
    for (const deserliazedHistory of deserialized) {
        const snapshots = deserliazedHistory.snapshots.map(HubspotDealSnapshot.fromObject);
        histories.push(new HubspotDealHistory(snapshots));
    }
    return histories;
}

class HubspotDealSnapshot extends HubspotDeal {

    constructor(
        public snapshotDate: Date,
        name: string,
        closeDate: Date,
        amount: number,
        weight: number,
        pipeline: string,
        dealstageId: number,
        ownerId: number,
        owner?: string,
        dealstage?: string,

    ) {
        super(name, closeDate, amount, weight, pipeline, dealstageId, ownerId, owner, dealstage);
    }

    static fromObject(obj: Partial<HubspotDealSnapshot>): Partial<HubspotDealSnapshot> {
        return new HubspotDealSnapshot(
            obj["snapshotDate"],
            obj["name"],
            obj["closeDate"],
            obj["amount"],
            obj["weight"],
            obj["pipeline"],
            obj["dealstageId"],
            obj["ownerId"],
            obj["owner"],
            obj["dealstage"]
        )
    }

    diff(other: Partial<HubspotDealSnapshot>): Partial<SnapshotDiff> {
        const diff = [];
        const thisKeys = Object.keys(this);
        for (const key of thisKeys) {
            if (this[key] !== other[key] && key !== "snapshotDate") {
                diff.push({
                    property: key as APIDealProperties,
                    oldValue: this[key],
                    newValue: other[key],
                    timestamp: other.snapshotDate,
                });
            }
        }
        const otherKeys = Object.keys(other);
        const newKeys = otherKeys.filter(key => !thisKeys.includes(key));
        for (const key of newKeys) {
            diff.push({
                property: key as APIDealProperties,
                oldValue: null,
                newValue: other[key],
                timestamp: other.snapshotDate,
            });
        }
        return diff;
    }
}

interface DiffHistory {
    initialDeal: Partial<HubspotDealSnapshot>;
    changes: SnapshotDiff[];
}

type SnapshotDiff = SnapshotPropertyDiff[];

interface SnapshotPropertyDiff {
    property: APIDealProperties;
    oldValue: string;
    newValue: string;
    timestamp: Date;
}

export interface HubspotPropertyMappers {
    dealStageMapper: (dealStageId: number) => Promise<string>;
    ownerMapper: (ownerId: number) => Promise<string>;
}

export function calculateWeightedAmount(deals: HubspotDeal[], date: Date): number {
    return deals
        .filter(deal => isSameMonth(deal.closeDate, date))
        .reduce((sum, deal) => sum + deal.weightedAmount, 0);
}

export class HubspotDealHistory {
    constructor(readonly snapshots: Partial<HubspotDealSnapshot>[]) {

    }

    static fromDeal(deal: HubspotDeal, snapshotDate: Date): HubspotDealHistory {
        const snapshot = new HubspotDealSnapshot(
            snapshotDate,
            deal.name,
            deal.closeDate,
            deal.amount,
            deal.weight,
            deal.pipeline,
            deal.dealstageId,
            deal.ownerId,
            deal.owner,
            deal.dealstage,
        );
        return new HubspotDealHistory([snapshot]);
    }

    static async fromDealsAPIResult(apiObject: APIDeal, mappers: HubspotPropertyMappers): Promise<HubspotDealHistory> {
        const sortedUpdates = [];
        for (const property in apiObject.propertiesWithHistory) {
            const values = apiObject.propertiesWithHistory[property];
            for (const value of values) {
                sortedUpdates.push({
                    property,
                    value: value.value,
                    timestamp: new Date(value.timestamp),
                });
            }
        }
        sortedUpdates.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const snapshots = [];
        let deal: Partial<HubspotDealSnapshot> = {};
        for (const update of sortedUpdates) {
            const translatedProperty = translateDealProperty(update.property);
            const value = propertyMapper[update.property](update.value);
            const dealObj = {
                ...deal,
                [translatedProperty]: value,
                snapshotDate: new Date(update.timestamp)
            };
            if (translatedProperty === "dealstageId") {
                dealObj["dealstage"] = await mappers.dealStageMapper(value);
            }
            if (translatedProperty === "ownerId") {
                dealObj["owner"] = await mappers.ownerMapper(value);
            }
            deal = HubspotDealSnapshot.fromObject(dealObj);

            const needsNewSnapshot = snapshots.length === 0 ||
                !isEqual(snapshots[snapshots.length - 1].snapshotDate, deal.snapshotDate);
            if (needsNewSnapshot) {
                snapshots.push(deal);
            } else {
                snapshots[snapshots.length - 1] = deal;
            }
        }
        return new HubspotDealHistory(snapshots);
    }

    diffHistory(): DiffHistory {
        const changes = [];
        for (let i = 0; i < this.snapshots.length - 2 ; i++) {
            const diff = this.snapshots[i].diff(this.snapshots[i + 1]);
            if (diff.length > 0) {
                changes.push(diff);
            }
        }
        return {
            initialDeal: this.snapshots[0],
            changes
        };
    }

    // Get the status of the deal at a given date
    snapshotAt(date: Date): Partial<HubspotDeal> {
        const initialDeal = this.snapshots[0];
        if (!initialDeal || isBefore(date, initialDeal.snapshotDate)) {
            return undefined;
        }
        for (let i = 1; i<this.snapshots.length; i++) {
            if (isBefore(date, this.snapshots[i].snapshotDate)) {
                return this.snapshots[i - 1];
            }
        }
        return this.snapshots[this.snapshots.length - 1];
    }

    addSnapshot(snapshot: HubspotDealSnapshot): void {
        this.snapshots.push(snapshot);
    }
}