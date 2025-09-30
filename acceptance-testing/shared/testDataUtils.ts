import { ItemHierarchy } from "../config/boilerplate/contract";

export function extractTitle(item: ItemHierarchy): string {
    if (item.name)  {
        return item.name;
    }
    if (item.languages && item.languages.length) {
        return item.languages[0].title;
    }
    throw new Error("Item has no title");
}