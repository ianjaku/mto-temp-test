import { dumpFile, loadFile } from "./fs";

export const dumpJSON = async (data: unknown, filePath: string, pretty?: boolean): Promise<void> => {
    const jsonData = pretty ?
        JSON.stringify(data, undefined, 4) :
        JSON.stringify(data);
    await dumpFile(filePath, jsonData);
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const loadJSON = async (filePath: string) => {
    const data = await loadFile(filePath);
    const decoded = JSON.parse(data);
    if (decoded) {
        return decoded;
    } else {
        throw new Error("Invalid json: " + data);
    }
};
