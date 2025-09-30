import { existsSync, realpathSync } from "fs";
import { IDevConfig } from "../actions/localdev/build";
import { loadJSON } from "./json";

export default async function loadConfig(configFilePath: string): Promise<IDevConfig> {
    if (!existsSync(configFilePath)) {
        throw new Error(`Config file not found in ${configFilePath} directory, please rename devConfig-sample.json to devConfig.json and tweak the parameters to match your environment`);
    }
    const jsonFile = realpathSync(configFilePath);
    return await loadJSON(jsonFile) as IDevConfig;
}