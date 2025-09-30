/* eslint-disable no-undef */
import { areManualtoAzureCoreServicesHealthy } from "../health-check.js"
import { expect } from "chai"
import fs from "fs";

async function loadFile(path) {
    return new Promise((resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                return resolve(data.toString());
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function loadJSON(filePath) {
    const data = await loadFile(filePath);
    const decoded = JSON.parse(data);
    if (decoded) {
        return decoded;
    } else {
        throw new Error("Invalid json: " + data);
    }
}

describe("isAzureHealthy", () => {
    it("should return true for empty response", async () => {
        const path = fs.realpathSync("./tests/test-data/empty.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(true)
    })

    it("should return false when app service impacted in west europe region", async () => {
        const path = fs.realpathSync("./tests/test-data/app-service-west-eu.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(false)
    })

    it("should return true when app service impacted in other region", async () => {
        const path = fs.realpathSync("./tests/test-data/app-service-west-us.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(true)
    })

    it("should return false when aks impacted in west europe region", async () => {
        const path = fs.realpathSync("./tests/test-data/aks-west-eu.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(false)
    })

    it("should return false when storage impacted in west europe region", async () => {
        const path = fs.realpathSync("./tests/test-data/storage-west-eu.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(false)
    })

    it("should return false when backup impacted in west europe region", async () => {
        const path = fs.realpathSync("./tests/test-data/backup-west-eu.json")
        const testResponse = await loadJSON(path)
        expect(areManualtoAzureCoreServicesHealthy(testResponse)).to.equal(false)
    })
})