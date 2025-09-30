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


describe("binders get", () => {
    it("should retrieve a binder by id", () => {
        const repo = getRepo();
        const binderId = "AVeKtMLvv4leLVo6N1Iw";
        return repo.getBinder(binderId)
            .then(result => {
                expect(result.id).toEqual(binderId);
            });
    });
});