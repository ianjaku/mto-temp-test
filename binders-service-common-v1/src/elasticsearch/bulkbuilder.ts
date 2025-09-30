/* eslint-disable @typescript-eslint/ban-types */
export type BulkOperation = "index" | "create" | "update" | "delete";

export class BulkBuilder {

    constructor(private actions: Object[] = []) { }
    private buildFirstLine(bulkOpType: BulkOperation, indexName: string, id?: string) {
        const opLineDetails = { _index: indexName };
        if (id) {
            opLineDetails["_id"] = id;
        }
        return { [bulkOpType]: opLineDetails };
    }

    private addParts(newParts: Object[]): BulkBuilder {
        return new BulkBuilder(this.actions.concat(newParts));
    }

    addCreate(indexName: string, doc: Object, id?: string): BulkBuilder {
        return this.addParts([
            this.buildFirstLine("create", indexName, id),
            { ...doc }
        ]);
    }

    addUpdate(indexName: string, id: string, update: Object): BulkBuilder {
        return this.addParts([
            this.buildFirstLine("update", indexName, id),
            { doc: update }
        ]);
    }

    addIndex(indexName: string, toIndex: Object, id?: string): BulkBuilder {
        return this.addParts([
            this.buildFirstLine("index", indexName, id),
            { ...toIndex }
        ]);
    }

    addDelete(indexName: string, id: string): BulkBuilder {
        return this.addParts([
            this.buildFirstLine("delete", indexName, id)
        ]);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    build() {
        return {
            actions: this.actions,
        };
    }
}