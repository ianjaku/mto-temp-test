import { SearchTableConfig } from "./types";

export function getId<T extends Record<string, string>>(obj: T, config: SearchTableConfig<T>): string | null {
    const idField = config.idField || "id";
    if (idField in obj) {
        return obj[idField];
    }
    return null;
} 