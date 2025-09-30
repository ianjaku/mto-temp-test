import * as configData from "../config";
import { DefaultESQueryBuilderHelper } from "../../../src/repositoryservice/esquery/helper";
import { ElasticPublicationsRepository } from "../../../src/repositoryservice/repositories/publicationrepository";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { ObjectConfig } from "@binders/client/lib/config/config";
import { Publication } from "@binders/client/lib/clients/repositoryservice/v3/contract";

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
    return new ElasticPublicationsRepository(config, logger, queryBuilderHelper);
}

const getNewPublication = () => {
    return {
        binderId: "somebinder",
        accountId: configData.ACCOUNT_ID,
        /* tslint:disable-next-line:no-any */
        bindersVersion: "0.3.0",
        thumbnail: {
            bgColor: "ffffff",
            fitBehaviour: "fit",
            medium: "http://image"
        },
        language: {
            iso639_1: "en",
            modules: ["t1"],
            storyTitle: "Nice binder enal",
            storyTitleRaw: "Nice binder enal"
        },
        links: {indexPairs: [["t1", "i1"]]},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        modules: {meta: <any> [], text: {chunked: []}, images: {chunked: []}},
        isActive: true,
        publicationDate: new Date(),
        publishedBy: "uid-special-userId",
        authorIds: [],
    };
};

describe("publication save", () => {
    it("should create a new publication", () => {
        const publication: Publication = getNewPublication();
        const repo = getRepo();
        return repo.save(publication)
            .then(savedPublication => {
                expect(savedPublication.id).toBeDefined();
                return repo.delete(savedPublication.id);
            });
    });
    it("should update an existing publication", () => {
        const publication: Publication = getNewPublication();
        const repo = getRepo();
        return repo.save(publication)
            .then(savedPublication => {
                expect(savedPublication.id).toBeDefined();
                expect(savedPublication.isActive).toEqual(true);
                savedPublication.isActive = false;
                return repo.save(savedPublication)
                    .then(() => repo.delete(savedPublication.id));
            });
    });
});