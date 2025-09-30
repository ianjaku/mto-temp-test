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
    services: {
        routing: {
            prefix: "/routing",
            location: "http://localhost:8008"
        }
    },
    session: {
        secret: "D6Zf8aMX8cUMMuRjZemzXja6Fvpy8Ub2PKDw3B4eFhrFYv46ZjDH87QQptXAh7aw"
    }
});

const logger = LoggerBuilder.fromConfig(config);

function getRepo() {
    const queryBuilderHelper = new DefaultESQueryBuilderHelper(config);
    return new ElasticBindersRepository(config, logger, queryBuilderHelper);
}

describe("binders find", () => {
    it( "should retrieve all binders when no filter is specified", () => {
        const repo = getRepo();
        const filter = {};
        const options = {maxResults: 10};
        return repo.findBinders(filter, options)
            .then(binders => {
                expect(binders.length).toEqual(10);
            });
    });
});
