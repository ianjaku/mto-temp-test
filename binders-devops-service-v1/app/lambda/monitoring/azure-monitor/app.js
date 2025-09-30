/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable no-undef */
import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch"
import { GetSecretValueCommand, SecretsManagerClient, } from "@aws-sdk/client-secrets-manager";
import { ClientSecretCredential } from "@azure/identity"
import { areManualtoAzureCoreServicesHealthy } from "./health-check.js"
import axios from "axios";

const CLIENT_CONFIG = { region: process.env.AWS_REGION }

async function getSecret(SecretId) {
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

async function getAzureParameters() {
    const clientIdPromise = getSecret(process.env.ClientIdSecretId)
    const clientSecretPromise = getSecret(process.env.ClientSecretSecretId)
    const subscriptionIdPromise = getSecret(process.env.SubscriptionIdSecretId)
    const tennantIdPromise = getSecret(process.env.TennantIdSecretId)
    const [clientId, clientSecret, subscriptionId, tennantId] = await Promise.all([clientIdPromise, clientSecretPromise, subscriptionIdPromise, tennantIdPromise])
    return {
        clientId,
        clientSecret,
        subscriptionId,
        tennantId
    }
}

async function getAzureToken(clientId, clientSecret, tennantId) {
    const credential = new ClientSecretCredential(tennantId, clientId, clientSecret);
    const accessToken = await credential.getToken("https://management.azure.com//.default")
    return accessToken?.token
}

async function getAzureHealthInfo(subscriptionId, token) {
    const url = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.ResourceHealth/events?api-version=2018-07-01`
    const authorization = `Bearer ${token}`
    try {
        const result = await axios.get(url, {
            headers: {
                Authorization: authorization,
            }
        });
        return result?.data
    } catch (error) {
        console.log(error)
        return null
    }
}

async function createCustomMetric(Value) {
    const MetricName = process.env.MetricName
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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const lambdaHandler = async (event, context) => {
    try {
        console.log({ event, context })
        const { clientId, clientSecret, subscriptionId, tennantId } = await getAzureParameters()
        const token = await getAzureToken(clientId, clientSecret, tennantId)
        const healthInfoResponse = await getAzureHealthInfo(subscriptionId, token)
        const healthy = areManualtoAzureCoreServicesHealthy(healthInfoResponse)
        console.log("Health", healthy)
        const metricValue = healthy ? 0 : 1
        await createCustomMetric(metricValue)
    } catch (error) {
        console.error(error)
        await createCustomMetric(1)
        return error
    }
};
