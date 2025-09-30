import * as LaunchDarkly from "launchdarkly-node-server-sdk";
import { Env } from "./environment";
import { loadSecrets } from "./secrets";


async function getLaunchDarklyClient(sdkKey: string) {
    const ldClient = await LaunchDarkly.init(sdkKey);
    try {
        await ldClient.waitForInitialization();
        return ldClient
    } catch (error) {
        throw new Error(`Initialization of LaunchDarkly failed... ${error}`, )
    }
}

export async function withLDClient<T>(enviroment: Env, branch: string, cb: (client: LaunchDarkly.LDClient) => Promise<T>): Promise<T> {
    const bindersSecrets = await loadSecrets(enviroment, branch)
    const client = await getLaunchDarklyClient(bindersSecrets.launchDarkly.sdkKey)
    return cb(client)
}

export async function getFlag<T>(client: LaunchDarkly.LDClient, flagKey: string, userKey = "default"): Promise<T> {
    try {
        const user = { key: userKey };
        const flagValue = await client.variation(flagKey, user, undefined) as T;
        return flagValue;
    } catch (error) {
        throw new Error("Can't connect with launch darkly")
    }

}