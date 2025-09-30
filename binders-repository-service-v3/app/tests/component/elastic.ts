import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { DefaultESQueryBuilderHelper } from "../../src/repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../src/repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { TestFixtures } from "@binders/binders-service-common/lib/testutils/fixtures/testfixtures";

function randomName() {
    return Math.random().toString(36).substr(2, 9)
}
const TEST_NAME = "integration/elastic.ts";
const config = BindersConfig.get();
const globalFixtures = new TestFixtures(config);

const logger = LoggerBuilder.fromConfig(config, TEST_NAME);


describe("exists-create-delete-test", () => {

    it("checks existance and creation of indices", async () => {
        await globalFixtures.withAnyAccount(async () => {
            const repo = new ElasticBindersRepository(config, logger, new DefaultESQueryBuilderHelper(config));
            const fakeIndexName = `index-${randomName()}`;
            const noneExisting = await repo.indexExists(fakeIndexName);
            expect(noneExisting).toEqual(false);
            await repo.createIndex(fakeIndexName);
            const existing = await repo.indexExists(fakeIndexName);
            expect(existing).toEqual(true);
            await repo.deleteIndex(fakeIndexName);
            const stillExists = await repo.indexExists(fakeIndexName);
            expect(stillExists).toEqual(false);
        })
    })
})