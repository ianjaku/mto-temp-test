import MiniSearch, { Options, Query, SearchOptions } from "minisearch";
import { useEffect, useMemo, useRef, useState } from "react"

type IdLike = string | number;

function uniqBy<T>(fieldFn: (doc: T) => string, arr: T[]): T[] {
    const visited = new Set<string>();
    const res = [];
    for (const item of arr) {
        const itemId = fieldFn(item);
        if (visited.has(itemId)) {
            continue;
        }
        visited.add(itemId);
        res.push(item);
    }
    return res;
}

export interface UseSearch<T> {
    search: (query: Query, options?: SearchOptions) => void;
    results: T[] | null;
    add: (document: T) => void;
    addAll: (documents: readonly T[]) => void;
    remove: (document: T) => void;
    removeAll: (documents?: readonly T[]) => void;
    clearSearch: () => void;
    idField: string;
    extractField: (document: T, field: string) => string;
}

export function useSearch<T> (documents: T[], options: Options<T> & { wildcard?: string }): UseSearch<T> {
    const optionsRef = useRef(options);
    const miniSearchRef = useRef<MiniSearch<T>>(new MiniSearch<T>(options));
    const documentByIdRef = useRef<{ [key: string]: T }>({});
  
    const [results, setResults] = useState<T[] | null>(null);
  
    const utils = useMemo(() => {
        const miniSearch = miniSearchRef.current;
        const documentById = documentByIdRef.current;
        const options = optionsRef.current;
  
        const idField = options.idField || MiniSearch.getDefault("idField") as Options["idField"];
        const extractField = options.extractField || MiniSearch.getDefault("extractField") as Options["extractField"];
        
        const search = (query: string, searchOptions?: SearchOptions): void => {
            const isWildcard = options.wildcard != null && query.trim() === options.wildcard;
            const results = isWildcard ?
                Object.keys(documentById) :
                miniSearch.search(query, searchOptions).map(({ id }) => id);
            const searchResults = results.map(id => documentById[id]);
            setResults(searchResults);
        }
  
        const add = (document: T): void => {
            documentByIdRef.current[extractField(document, idField)] = document;
            miniSearch.add(document);
        }
  
        const addAll = (documents: readonly T[]): void => {
            const byId = documents.reduce((byId, doc) => {
                const id = extractField(doc, idField);
                byId[id] = doc;
                return byId;
            }, {});
            documentByIdRef.current = Object.assign(documentById, byId);
            miniSearch.addAll(documents);
        }
  
        const remove = (document: T): void => {
            miniSearch.remove(document);
            documentByIdRef.current = removeFromMap<T>(documentById, extractField(document, idField));
        }
  
        const removeAll = function (documents?: readonly T[]): void {
            if (arguments.length === 0) {
                miniSearch.removeAll();
                documentByIdRef.current = {};
            } else {
                miniSearch.removeAll(documents);
                const idsToRemove = documents.map((doc) => extractField(doc, idField));
                documentByIdRef.current = removeManyFromMap<T>(documentById, idsToRemove);
            }
        }
  
        const clearSearch = (): void => {
            setResults(null);
        }
  
        return {
            search,
            add,
            addAll,
            remove,
            removeAll,
            clearSearch,
            idField,
            extractField,
        };
    }, []);
  
    useEffect(() => {
        const uniqueDocuments = uniqBy(
            doc => utils.extractField(doc, utils.idField),
            documents,
        );

        utils.addAll(uniqueDocuments);
  
        return () => {
            utils.removeAll(uniqueDocuments);
        }
    }, [utils, documents]);

    return {
        results,
        ...utils,
    }
}

function removeFromMap<T> (map: { [key: string]: T }, keyToRemove: IdLike): { [key: string]: T } {
    delete map[keyToRemove]
    return map
}
  
function removeManyFromMap<T> (map: { [key: string]: T }, keysToRemove: readonly IdLike[]): { [key: string]: T } {
    keysToRemove.forEach((keyToRemove) => {
        delete map[keyToRemove]
    })
    return map
}