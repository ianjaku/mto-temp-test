import { getKeyVaultSecret } from "../actions/azure/keyvault";
import { getLocalDevopsServiceDir } from "../actions/git/local";
import { loadKeyVaultData } from "./terraform";

export const getCodeConfigDir = async (): Promise<string> => {
    const devopsDir = await getLocalDevopsServiceDir();
    return `${devopsDir}/app/src/config`;
};

type SlackChannels = {
    appAlerts: string,
    criticalAlerts: string,
    infraAlerts: string,
    prometheus: string,
    prometheusStaging: string,
    wafAlerts: string,
}

export interface IDevopsConfig {
    elasticBindersPassword: string
    elasticLogeventsPassword: string
    grafanaAdminPassword: string
    mongoMetricsPassword: string
    pagerDuty: { integrationKey: string }
    slack: SlackChannels;
    smtp: {
        gmail?: { login: string, password: string }
    };
    users: [{ login: string, password: string }];
}

export const getDevopsConfig = async (): Promise<IDevopsConfig> => {
    const { keyVaultUri, devopsSecretName } = await loadKeyVaultData("production")
    const secret = await getKeyVaultSecret(keyVaultUri, devopsSecretName)
    return JSON.parse(secret.value) as IDevopsConfig
};