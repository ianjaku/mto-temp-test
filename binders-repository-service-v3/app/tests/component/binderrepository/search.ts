import * as configData from "../config";
import { DefaultESQueryBuilderHelper } from "../../../src/repositoryservice/esquery/helper";
import { ElasticBindersRepository } from "../../../src/repositoryservice/repositories/binderrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";

const config = new ObjectConfig({
    elasticsearch: {
        clusters: {
            binders: {
                "host": "http://dockerhost:9200",
                "apiVersion": "2.4",
                "sniffOnStart": false
            }
        }
    },
    logging: {
        default: {
            level: "TRACE"
        }
    },
    session: {
        secret: "fake"
    }
});

const logger = LoggerBuilder.fromConfig(config);

function getRepo() {
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
}

describe("binders search", () => {
    it("should retrieve binders with hits", () => {
        const repo = getRepo();
        const query = "cappuccino";
        const options = { maxResults: 250 };
        return repo.searchBinders(query, options, configData.ACCOUNT_ID)
            .then(searchHits => {
                expect(searchHits.totalHitCount).not.toEqual(0);
                expect(searchHits.hits.length).not.toEqual(0);
                expect(searchHits.hits[0].fieldHits.length).not.toEqual(0);
            });
    });
    it("should filter binders without hits", () => {
        const repo = getRepo();
        const query = "cappuccino";
        const options = { maxResults: 250 };
        return repo.searchBinders(query, options, "otheraccount")
            .then(searchHits => {
                expect(searchHits.totalHitCount).toEqual(0);
                expect(searchHits.hits.length).toEqual(0);
            });
    });
});
