import {
    Account,
    AccountServiceContract,
    ICustomer
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { MetricMap, Mode } from "./contract";
import {
    buildHeaders,
    getMetricMapForAccountId,
    monthsBetweenYears,
    replaceUndefinedWithNoData
} from "./helpers";
import { TrackingServiceContract } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { YEAR_RANGE } from "./constants";

async function customerMetricsFor(
    customers: ICustomer[],
    allAccounts: Account[],
    trackingServiceClient: TrackingServiceContract,
    mode: Mode,
): Promise<string> {

    const months = monthsBetweenYears(YEAR_RANGE.from, YEAR_RANGE.until);
    let csv = "";
    csv = `${csv}${buildHeaders(mode, months)}\n`;

    for await (const customer of customers) {
        const accounts = customer.accountIds.map(accountId => allAccounts.find(account => account.id === accountId));
        const totals: MetricMap = {};

        for (const account of accounts) {
            const accountMetricMap = await getMetricMapForAccountId(account.id, months, { trackingService: trackingServiceClient });
            for (const metricName of Object.keys(accountMetricMap).sort()) {
                const metricValues = accountMetricMap[metricName];
                const values = replaceUndefinedWithNoData(metricValues);
                if (mode === "account") {
                    csv = `${csv}${[customer.id, customer.crmCustomerId, customer.name, account.id, account.name, metricName, values].join(",")}\n`;
                }
                const totalValuesSoFar = totals[metricName] || months.map(() => 0);
                const totalValues = totalValuesSoFar.map((t, i) => t + metricValues[i]);
                totals[metricName] = totalValues;
            }
        }
        if (mode === "customer") {
            for (const metricName of Object.keys(totals)) {
                const values = replaceUndefinedWithNoData(totals[metricName]);
                csv = `${csv}${[customer.id, customer.crmCustomerId, customer.name, metricName, values].join(",")}\n`;
            }
        }
    }
    return csv;

}

/*
    @param mode: when set to "account", we add individual account rows, else we aggregate all accounts per customer
    @param accountId: restrict to one account
*/
export default async function (
    accountServiceClient: AccountServiceContract,
    trackingServiceClient: TrackingServiceContract,
    mode: Mode = "customer",
    accountId?: string,
): Promise<string> {
    const [customers, allAccounts] = accountId ?
        [
            await accountServiceClient.findCustomers({ accountId }),
            [await accountServiceClient.getAccount(accountId)],
        ] :
        [
            await accountServiceClient.listCustomers(),
            await accountServiceClient.findAccounts({}),
        ];
    return await customerMetricsFor(
        customers,
        allAccounts,
        trackingServiceClient,
        mode,
    );
}