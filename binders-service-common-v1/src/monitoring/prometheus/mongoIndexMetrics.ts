import * as prometheusClient from "prom-client";
import { createGauge, getMetricName } from "../prometheus";
import { IndexDiff } from "../../mongo/indices/model";

const LABEL_NAMES = ["collection"];

export type Gauge = prometheusClient.Gauge;

const createMissingIndexGauge = (): Gauge => {
    const name = getMetricName("mongo_index_missing");
    const help = "Gauge keeping track of the number of collections with missing mongo indices";
    return createGauge(name, help, LABEL_NAMES);
};

const createExtraIndexGauge = (): Gauge => {
    const name = getMetricName("mongo_index_extra");
    const help = "Gauge keeping track of the number of collections with additional mongo indices";
    return createGauge(name, help, LABEL_NAMES);
};


const createMissingCollectionsGauge = (): Gauge => {
    const name = getMetricName("mongo_collection_missing");
    const help = "Gauge keeping track of the number of missing mongo collections";
    return createGauge(name, help, LABEL_NAMES);
}

let missingIndexGauge: Gauge;
let extraIndexGauge: Gauge;
let missingCollectionGauge: Gauge;

export function createMongoIndexGauges(): void {
    missingIndexGauge = createMissingIndexGauge();
    extraIndexGauge = createExtraIndexGauge();
    missingCollectionGauge = createMissingCollectionsGauge();
}

export function updateMongoIndexGauges(collectionName: string, indexDiff: IndexDiff): void {
    const labels = { collection: collectionName };
    if (indexDiff.status === "error") {
        return;
    }
    if (indexDiff.status === "collection_missing") {
        missingCollectionGauge.set(labels, 1);
        extraIndexGauge.set(labels, 0);
        missingIndexGauge.set(labels, 0);
        return;
    }
    const { details } = indexDiff;
    missingCollectionGauge.set(labels, 0);
    extraIndexGauge.set(labels, details.toDrop.length);
    missingIndexGauge.set(labels, details.toCreate.length);
}

export function resetMongoGauges(collectionName: string): void {
    const labels = { collection: collectionName };
    missingCollectionGauge.set(labels, 0);
    extraIndexGauge.set(labels, 0);
    missingIndexGauge.set(labels, 0);
}