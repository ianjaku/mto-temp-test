import { dump, load } from "js-yaml";
import { dumpFile, loadFile } from "./fs";

export const dumpYaml = (data: unknown, filePath: string): Promise<void> => {
    const yamlData = yamlStringify(data, true);
    return dumpFile(filePath, yamlData);
};

export const loadYaml = async (filePath: string): Promise<unknown> => {
    const data = await loadFile(filePath);
    return yamlParse(data);
};

/**
 * Serializes passed in data into a YAML formatted string
 * @param data passed in data
 * @param noRefs if <code>true</code>, don't convert duplicate objects into references (default: <code>false</code>)
 */
export const yamlStringify = (data: unknown, noRefs = false): string => dump(data, { noRefs });

/**
 * Deserializes a YAML formatted string into an actual JS structure
 * @param str
 */
export const yamlParse = <T = unknown>(str: string): T => load(str) as T;
