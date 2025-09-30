/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable no-undef */
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";
import { GetSecretValueCommand, SecretsManagerClient, } from "@aws-sdk/client-secrets-manager";
import axios from "axios";
const CLIENT_CONFIG = { region: process.env.AWS_REGION }

const getSecret = async (SecretId) => {
    try {
        const client = new SecretsManagerClient(CLIENT_CONFIG);
        const command = new GetSecretValueCommand({ SecretId });
        const response = await client.send(command);
        return response.SecretString
    } catch (error) {
        console.log(error)
        return null
    }


}

const checkHealth = async (url) => {
    const username = await getSecret(process.env.PrometheusUsernameSecretId)
    const password = await getSecret(process.env.PrometheusPasswordSecretId)
    const encodedBase64Token = Buffer.from(`${username}:${password}`).toString("base64");

    const authorization = `Basic ${encodedBase64Token}`;
    try {
        const { status } = await axios.get(url, {
            headers: {
                Authorization: authorization,
            }
        });
        console.log("Response status code: ", status, url)
        return status === 200 ? true : false
    } catch (error) {
        console.log(error)
        return false
    }

}

const isAlertManagerHealthy = async () => {
    const url = process.env.AlertManagerHealthEndpointUrl;
    return checkHealth(url)
}

const isPrometheusHealthy = async () => {
    const url = process.env.PrometheusHealthEndpointUrl;
    return checkHealth(url)
}

const createCustomMetric = async (MetricName, Value) => {
    const Namespace = process.env.Namespace
    const client = new CloudWatchClient(CLIENT_CONFIG);
    const input = {
        MetricData: [{
            MetricName,
            Value
        }],
        Namespace,
    }
    const command = new PutMetricDataCommand(input);
    try {
        const data = await client.send(command);
        console.log(data)
    } catch (error) {
        console.log(error)
    }
}

export async function lambdaHandler() {
    try {
        const prometheusHealthy = await isPrometheusHealthy()
        const alertManagerHealthy = await isAlertManagerHealthy()

        const prometheusMetric = prometheusHealthy ? 0 : 1
        const prometheusMetricName = process.env.PrometheusMetricName
        await createCustomMetric(prometheusMetricName, prometheusMetric)

        const alertManagerMetric = alertManagerHealthy ? 0 : 1
        const alertManagerMetricName = process.env.AlertManagerMetricName
        await createCustomMetric(alertManagerMetricName, alertManagerMetric)
    } catch (err) {
        await createCustomMetric(1)
        console.log(err);
        return err;
    }
}
