import { DocumentAncestors } from "../clients/repositoryservice/v3/contract";
import { Set } from "immutable";
import { difference } from "ramda";
import { hasAtLeastOneVisibleParentPath } from "./helpers";

export interface AncestorItem {
    id: string;
    isHidden: boolean;
    isDeleted: boolean;
    showInOverview?: boolean;
}

export type AncestorItems = { [itemId: string]: AncestorItem[] };

export class Ancestors {
    constructor(private items: AncestorItems = {}) {

    }

    getFilteredItems(filterHidden = true): {[id: string]: AncestorItem[]} {
        const itemIds = Object.keys(this.items);
        const invisibleItems = itemIds.reduce(
            (reduced, itemId) => {
                const invisible = this.items[itemId]
                    .filter(i => filterHidden && i.isHidden)
                    .map(i => i.id);
                return reduced.union(invisible);
            }, Set()
        );
        return itemIds
            .filter(id => !invisibleItems.has(id))
            .filter(id => (!filterHidden || hasAtLeastOneVisibleParentPath(this, [id], [])))
            .reduce((result, key) => {
                const items = this.items[key].filter(dp => (!filterHidden || !dp.isHidden))
                return Object.assign(result, {[key]: items});
            }, {});
    }

    getAllItemsFlat(): AncestorItem[] {
        const resultMap = Object.values(this.getItems()).reduce((acc, ancestorItems) => {
            ancestorItems.forEach(ancestorItem => {
                acc.set(ancestorItem.id, ancestorItem);
            });
            return acc;
        }, new Map<string, AncestorItem>());
        return Array.from(resultMap.values());
    }

    toDocumentAncestors(filterHidden: boolean): DocumentAncestors {
        const filteredItems = this.getFilteredItems(filterHidden);
        return Object.keys(filteredItems)
            .reduce((result, key) => {
                const items = filteredItems[key]
                    .filter(dp => (!filterHidden || !dp.isHidden))
                    .map(dp => dp.id)
                return Object.assign(result, {[key]: items});
            }, {});
    }

    isEmpty(): boolean {
        return Object.keys(this.items).length === 0;
    }

    addElement(itemId: string, parents: AncestorItem[]): Ancestors {
        const newItems = { ...this.items, [itemId]: parents };
        return new Ancestors(newItems);
    }

    difference(other: Ancestors): string[] {
        return difference(Object.keys(this.items), Object.keys(other.items));
    }

    has(key: string): boolean {
        return (key in this.items);
    }

    keys(): string[] {
        return Object.keys(this.items);
    }

    merge(other: Ancestors): Ancestors {
        const newItems = { ...this.items, ...other.items };
        return new Ancestors(newItems);
    }

    get(key: string): AncestorItem[] {
        return this.items[key] || [];
    }

    multiget(keys: string[]): AncestorItem[] {
        return keys.reduce((reduced, key) => reduced.concat(this.get(key)), []);
    }

    async findClosestParent(keys: string[], conditionFn: (key: string) => Promise<boolean>, i = 0): Promise<AncestorItem> {
        const parents = this.multiget(keys);
        if (!parents.length) {
            return undefined;
        }
        const parentIds = parents.map(({ id }) => id);
        const results = await Promise.all(parentIds.map(conditionFn));
        const successIndex = results.findIndex(r => !!r);
        if (successIndex >= 0) {
            return parents[successIndex];
        }
        return this.findClosestParent(parentIds, conditionFn, i + 1);
    }

    getItems(): AncestorItems {
        return this.items;
    }
}
