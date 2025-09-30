export class AncestorTree {
    private readonly items: { [id: string]: Set<string> }
    constructor() {
        this.items = {};
    }

    getDirectParents(id: string): Set<string> {
        return this.items[id];
    }

    addCollectionByIds(collectionId: string, childKeys: string[]): void {
        for(let i=0; i < childKeys.length; i++) {
            const key = childKeys[i];
            const currentParents = this.items[key];
            if (currentParents === undefined) {
                this.items[key] = new Set([collectionId]);
            } else {
                if (!currentParents.has(collectionId)) {
                    currentParents.add(collectionId);
                }
            }
        }
    }

    isDescendentOf(itemId: string, ancestorId: string): boolean {
        const directParentSet = this.getDirectParents(itemId);
        if (directParentSet === undefined || directParentSet.size === 0) {
            return false;
        }
        if (directParentSet.has(ancestorId)) {
            return true;
        }
        const directParents = directParentSet.values();
        let directParent = directParents.next();
        while (!directParent.done) {
            const parentIsDescendent = this.isDescendentOf(directParent.value, ancestorId);
            if (parentIsDescendent) {
                return true;
            }
            directParent = directParents.next();
        }
        return false;
    }

    toJSON(): Record<string, string[]> {
        const withArrays = {};
        for (const k of Object.keys(this.items)) {
            withArrays[k] = Array.from(this.items[k])
        }
        return withArrays;
    }

    static fromJSON(itemsParam: Record<string, string[]>): AncestorTree {
        const items = Object.entries(itemsParam).reduce((acc, [key, ids]) => {
            acc[key] = new Set(ids);
            return acc;
        }, {} as Record<string, Set<string>>);
        return Object.assign(Object.create(AncestorTree.prototype), { items });
    }
}