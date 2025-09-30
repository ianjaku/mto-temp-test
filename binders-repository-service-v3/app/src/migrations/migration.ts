import {
    ElasticQuery,
    ElasticRepository
} from "@binders/binders-service-common/lib/elasticsearch/elasticrepository";
import { BulkBuilder } from "@binders/binders-service-common/lib/elasticsearch/bulkbuilder";


export class ElasticMigrator {
    constructor(private source: ElasticRepository, private target: ElasticRepository) {
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    async migrate<A, B>(
        query: ElasticQuery,
        transform: (sourceDoc: A) => Promise<{ data: B, id?: string }>,
        targetIndex: string,
        overwrite: boolean
    ) {
        return this.source.runScroll<A>(query, 30, 100, batch => {
            return Promise.all(batch.map(transform))
                .then((bs) => {
                    return bs.reduce((builder, b) => overwrite ?
                        builder.addIndex(targetIndex, b.data, b.id) :
                        builder.addCreate(targetIndex, b.data, b.id)
                    , new BulkBuilder([]));
                })
                .then(bulk => this.target.runBulk(bulk, { ignoreDuplicates: !overwrite }));
        });
    }
}