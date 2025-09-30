/* eslint-disable no-console */
import * as fs from "fs";
import { CollectionConfig, getMongoLogin } from "@binders/binders-service-common/lib/mongo/config";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { Customer } from "../accountservice/model";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { MongoAccountRepositoryFactory } from "../accountservice/repositories/accounts";
import { MongoCustomerRepositoryFactory } from "../accountservice/repositories/customers";
import parse from "csv-parse/lib/es5";

const config = BindersConfig.get();
const loginOption = getMongoLogin("account_service");
const logger = LoggerBuilder.fromConfig(config);

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <pathToCsv>`);
        process.exit(1);
    }
    return {
        pathToCsv: process.argv[2],
    };
};

async function parseCsv(csv): Promise<Array<string[]>> {
    const output = [];
    const parser = parse({ delimiter: [",", ";"], relax_column_count: true });
    return new Promise((resolve, reject) => {
        parser.on("readable", function () {
            let record;
            // eslint-disable-next-line
            while ((record = parser.read())) {
                if (record && record.join() !== "") {
                    output.push(record);
                }
            }
        });
        parser.on("error", function (err) {
            reject(err);
        });
        parser.on("finish", function () {
            console.log("output", output)
            resolve(output);
        });
        const countriesRaw = fs.readFileSync(csv, "utf-8");
        const properLineEndingsCsv = countriesRaw.replace(/\r?\n|\r/g, "\n");
        parser.write(properLineEndingsCsv);
        parser.end();
    });
}

async function getAccountIdsFromCsv(): Promise<string[]> {
    const { pathToCsv } = getOptions();
    const [accountIds] = await parseCsv(pathToCsv);
    return accountIds;
}

(async function () {
    const accountIds = await getAccountIdsFromCsv();

    const accountsCollectionConfig = await CollectionConfig.promiseFromConfig(config, "accounts", loginOption);
    const accountsRepo = new MongoAccountRepositoryFactory(accountsCollectionConfig, logger).build(logger);
    const customersCollectionConfig = await CollectionConfig.promiseFromConfig(config, "mtCustomers", loginOption);
    const customersRepo = new MongoCustomerRepositoryFactory(customersCollectionConfig, logger).build(logger);
    const accounts = await accountsRepo.findAccountsForIds(accountIds);
    try {
        for await (const account of accounts) {
            const customer = Customer.create(account.name);
            customer.accountIds = [account.id];
            await customersRepo.saveCustomer(customer);
            console.log(`created customer "${account.name}"`);
        }
        process.exit(0);

    }
    catch (e) {
        console.error(e);
        process.exit(1)
    }
})();