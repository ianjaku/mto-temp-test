import { any } from "ramda";

type FieldIndexType = 1 | -1;
type IndexedFields = Record<string, FieldIndexType>;

interface IndexOptions {
    name: string;
    background: boolean;
    unique: boolean;
}

export interface IndexDefinition {
    fields: IndexedFields;
    options: IndexOptions;
}

export interface IndexesDiff {
    toCreate: IndexDefinition[];
    toDrop: IndexDefinition[];
}

export type IndexDiffStatus = "ok" | "collection_missing" | "error";
export interface IIndexDiff {
    status: IndexDiffStatus;
}

export interface IndexDiffError extends IIndexDiff {
    status: "error";
    details: Error;
}

export interface IndexDiffCollectionMissing extends IIndexDiff {
    status: "collection_missing";
}

export interface IndexDiffOk extends IIndexDiff {
    status: "ok";
    details: IndexesDiff;
}

export type IndexDiff = IndexDiffError | IndexDiffCollectionMissing | IndexDiffOk;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export function fromMongoDefinition(mongoIndexDefinition: any): IndexDefinition {
    const fields = mongoIndexDefinition["key"];
    const options = {
        name: mongoIndexDefinition.name,
        unique: !!mongoIndexDefinition.unique,
        background: !!mongoIndexDefinition.background
    }
    return {
        fields,
        options
    };
}

export function buildName(fields: IndexedFields): string {
    const parts = [];
    for (const k in fields) {
        parts.push(k);
        parts.push(fields[k])
    }
    return parts.join("_");
}

function completeSchemaIndex(def: IndexDefinition) {
    const { fields, options } = def;
    if (!options.name) {
        options.name = buildName(fields);
    }
    if (options.background == null) {
        options.background = !!options.background;
    }
    if (options.unique == null) {
        options.unique = !!options.unique;
    }
    return {
        fields,
        options
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export function fromSchemaDefinition(mongooseSchemaIndexDefinition: any): IndexDefinition {
    const [fields, options] = mongooseSchemaIndexDefinition;
    return completeSchemaIndex({
        fields,
        options
    })
}

function buildUniqueKey(definition: IndexDefinition, includeBackgroundOption = false) {
    const { fields, options } = definition;
    const name = buildName(fields);
    const optionsSuffixParts = [options.unique ? "u1" : "u0"];
    if (includeBackgroundOption) {
        optionsSuffixParts.push(options.background ? "b1" : "b0")
    }
    const optionsSuffix = optionsSuffixParts.join("_");
    return `${name}_${optionsSuffix}`;
}

export function equals(left: IndexDefinition, right: IndexDefinition): boolean {
    return buildUniqueKey(left) === buildUniqueKey(right);
}

export function diffIndexes(mongoIndices: IndexDefinition[], schemaIndices: IndexDefinition[]): IndexesDiff {
    const toCreate = schemaIndices.filter(
        schemaIx => ! any(
            mongoIx => equals(schemaIx, mongoIx),
            mongoIndices
        )
    );
    const toDrop = mongoIndices.filter(
        mongoIx => ! any(
            schemaIx => equals(mongoIx, schemaIx),
            schemaIndices
        )
    );
    return {
        toCreate,
        toDrop
    }
}