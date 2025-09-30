import * as prometheusClient from "prom-client";
import { Config } from "@binders/client/lib/config/config";

const PUSHGATEWAY_URL = "http://prometheus-prometheus-pushgateway.monitoring.svc.cluster.local:9091"

export const exportPrometheusMetrics = (): string => prometheusClient.register.metrics();

export const getClientContentType = (): string => prometheusClient.register.contentType

export const kickoffMonitoring = (service: string): void => {
    prometheusClient.register.setDefaultLabels({ binders_service: service });
    prometheusClient.collectDefaultMetrics();
};

export const getMetricName = (suffix: string): string => `manualto_${suffix.replace(/-/g, "_")}`;

export const createGauge = (name: string, help: string, labelNames: string[]): prometheusClient.Gauge => (
    new prometheusClient.Gauge({ name, help, labelNames })
);

export const createCounter = (name: string, help: string, labelNames: string[]): prometheusClient.Counter => (
    new prometheusClient.Counter({ name, help, labelNames })
);

export const createHistogram = (name: string, help: string, labelNames: string[], buckets: number[]): prometheusClient.Histogram =>
    new prometheusClient.Histogram({ name, help, labelNames, buckets });

const getAuthorizationToken = (config: Config) => {
    const devopsUser = config.getObject("devops.user")
    const { login, password } = devopsUser.get() as { login: string, password: string }
    return Buffer.from(`${login}:${password}`).toString("base64")
}

export const sendNotificationToPushgateway = async (config: Config, jobName: string): Promise<void> => {
    const options = {
        headers: {
            "Authorization": `Basic ${getAuthorizationToken(config)}`
        }
    }
    const gateway = new prometheusClient.Pushgateway(PUSHGATEWAY_URL, options);
    return new Promise((resolve, reject) => {
        gateway.pushAdd({ jobName }, (err, _, body) => {
            if (err) {
                reject(err)
            }
            resolve(body)
        })
    })
}

export const createRegistry = (): prometheusClient.Registry => (
    new prometheusClient.Registry()
);

export const sendMetricsToPushgateway = async (config: Config, jobName: string, register: prometheusClient.Registry): Promise<void> => {
    const options = {
        headers: {
            "Authorization": `Basic ${getAuthorizationToken(config)}`
        }
    }
    const gateway = new prometheusClient.Pushgateway(PUSHGATEWAY_URL, options, register);
    return new Promise((resolve, reject) => {
        gateway.pushAdd({ jobName }, (err, _, body) => {
            if (err) {
                // eslint-disable-next-line no-console
                console.log(err)
                reject(err)
            }
            resolve(body)
        })
    })
}