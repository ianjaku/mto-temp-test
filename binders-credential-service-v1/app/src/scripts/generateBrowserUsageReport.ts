/* eslint-disable no-console */
import { BackendCredentialServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";


const config = BindersConfig.get();

function getOptions() {
    return { daysAgo: process.argv[2] }
}

const helperSortFunction = (a: { value: number }, b: { value: number }) => {
    return b.value - a.value;
};

const sortObjectPropsByValue = (obj: Record<string, number>, total: number) => {
    return Object.keys(obj).map((prop) => ({
        name: prop,
        value: obj[prop],
        percentage: `${(obj[prop] / total * 100).toFixed(2)}%`
    })).sort(helperSortFunction);
}

const sortSubObjPropsByValue = (obj: Record<string, Record<string, number>>, total: number) => {
    const entries = Object.entries(obj).map(([k, v]) => {
        return [k, sortObjectPropsByValue(v, total)];
    });
    return Object.fromEntries(entries);
}


BackendCredentialServiceClient.fromConfig(config, "reader")
    .then(async (credentialServiceClient) => {
        const { daysAgo } = getOptions();
        const daysAgoNr = daysAgo ? Number.parseInt(daysAgo, 10) : undefined;
        const suffix = daysAgoNr ? ` for the last ${daysAgoNr} days` : "";
        console.log(`Fetching browser report${suffix}`)
        const result = await credentialServiceClient.getBrowserUsageReport(daysAgoNr);
        const total = result.mobileDesktop.mobile + result.mobileDesktop.desktop;
        const sortedFromHighestValue = {
            mobileToDesktop: result.mobileDesktop,
            browsers: sortObjectPropsByValue(result.browsers, total),
            browserVersions: sortSubObjPropsByValue(result.browserVersions, total),
            mobileDevices: sortObjectPropsByValue(result.mobileDevices, total),
            os: sortObjectPropsByValue(result.os, total),
        }
        console.log(JSON.stringify(sortedFromHighestValue, null, 2));
    });
