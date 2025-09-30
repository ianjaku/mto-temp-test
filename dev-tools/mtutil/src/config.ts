import { exec } from "child-process-promise";

export async function getDeeplConfig(): Promise<Record<string, string>> {
    const configRaw = await exec("kubectl -n develop get secret binders-config -o jsonpath=\"{.data.development\\.json}\" | base64 --decode");
    const config = JSON.parse(configRaw.stdout);
    return config["translator"]["deepl"];
}