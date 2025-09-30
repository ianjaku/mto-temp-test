/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { any } from "ramda";
import { getConfigSecret } from "../../lib/bindersenvironment";
import { getKubeCtlDecodedJson } from "../../lib/k8s";

/*
# ┌───────────── minute (0 - 59)
# │ ┌───────────── hour (0 - 23)
# │ │ ┌───────────── day of the month (1 - 31)
# │ │ │ ┌───────────── month (1 - 12)
# │ │ │ │ ┌───────────── day of the week (0 - 6) (Sunday to Saturday;
# │ │ │ │ │                                   7 is also Sunday on some systems)
# │ │ │ │ │
# │ │ │ │ │
# * * * * * command to execute
*/

export interface ICronSchedule {
    minute: string;
    hour: string;
    dayOfMonth: string;
    month: string;
    dayOfWeek: string;
}

const stringifySchedule = (schedule: ICronSchedule) => {
    const { minute, hour, dayOfMonth, month, dayOfWeek } = schedule;
    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
};

export const CRON_ANY = "*";

const validateMinute = (minute: number) => {
    if (0 <= minute && minute < 60) {
        return undefined;
    }
    return "Minutes should be >=0 and <60";
};

const validateHour = (hour: number) => {
    if (0 <= hour && hour <= 23) {
        return undefined;
    }
    return "Hours should be >=0 and <=23";
};

const validateWeekDay = (dayOfWeek: number) => {
    if (0 <= dayOfWeek && dayOfWeek <= 6) {
        return undefined;
    }
    return "Dayofweek should be >=0 and <=6";
};

const validateDayOfMonth = (dayOfMonth: number) => {
    if (1 <= dayOfMonth && dayOfMonth <= 31) {
        return undefined;
    }
    return "Dayofmonth should be >=1 and <=31";
};

const validateMonth = (month: number) => {
    if (1 <= month && month <= 12) {
        return undefined;
    }
    return "Month should be >=1 and <=12";
};


const validate = (maybeErrors: string[]): void => {
    const errors = maybeErrors.filter(e => !!e);
    if (errors.length > 0) {
        throw new Error(`Cron validation error : ${errors.join(",")}`);
    }
};

export const monthlyCronSchedule = (dayOfMonth: number): ICronSchedule => {
    validate([
        validateDayOfMonth(dayOfMonth)
    ])
    return {
        minute: "17",
        hour: "3",
        dayOfMonth: `${dayOfMonth}`,
        month: CRON_ANY,
        dayOfWeek: CRON_ANY
    };
}

export const everyNmonth = (n: number): ICronSchedule => {
    validate([
        validateMonth(n)
    ])
    return {
        minute: "4",
        hour: "15",
        dayOfMonth: CRON_ANY,
        month: `${CRON_ANY}/${n}`,
        dayOfWeek: CRON_ANY
    };
}

export const dailyCronSchedule = (hour: number, minute: number): ICronSchedule => {
    validate([
        validateHour(hour),
        validateMinute(minute)
    ]);
    return {
        minute: `${minute}`,
        hour: `${hour}`,
        dayOfMonth: CRON_ANY,
        month: CRON_ANY,
        dayOfWeek: CRON_ANY
    };
};

export const weeklySchedule = (dayOfWeek: number, hour: number, minute: number) => {
    validate([
        validateWeekDay(dayOfWeek),
        validateHour(hour),
        validateMinute(minute)
    ]);
    return {
        minute: `${minute}`,
        hour: `${hour}`,
        dayOfMonth: CRON_ANY,
        month: CRON_ANY,
        dayOfWeek: `${dayOfWeek}`
    }
}

export const everyNMinutesSchedule = (n: number, offset = 0) => {
    validate([
        validateMinute(n),
        validateMinute(offset)
    ]);
    let nextOccurence = offset;
    const occurences = [];
    while (nextOccurence < 60) {
        occurences.push(nextOccurence);
        nextOccurence += n;
    }
    return {
        minute: occurences.join(","),
        hour: CRON_ANY,
        dayOfMonth: CRON_ANY,
        month: CRON_ANY,
        dayOfWeek: CRON_ANY
    }
}

export const everyNHoursSchedule = (n: number, offset = 0, minute = 0) => {
    validate([
        validateHour(n),
        validateHour(offset),
        validateMinute(minute)
    ]);
    let nextOccurence = offset;
    const occurences = [];
    while (nextOccurence <= 23) {
        occurences.push(nextOccurence);
        nextOccurence += n;
    }
    return {
        minute: minute.toString(),
        hour: occurences.join(","),
        dayOfMonth: CRON_ANY,
        month: CRON_ANY,
        dayOfWeek: CRON_ANY
    }
}


type EnvValueFrom = {
    secretKeyRef?: {
        key: string,
        name: string
    },
    fieldRef?: {
        fieldPath: string
    }
}

export interface IEnvVar {
    name: string;
    value?: string;
    valueFrom?: EnvValueFrom
}

export interface IVolumeMount {
    name: string;
    mountPath: string;
    subPath?: string;
    readOnly?: boolean;
}

export interface ISecurityContext {
    runAsUser: number;
    privileged: boolean
}

export interface ComputeResources {
    memory?: string
    cpu?: string
}

export interface ResourceSpec {
    limits?: ComputeResources
    requests?: ComputeResources
}

export interface ICronjobContainer {
    name: string;
    image: string;
    imagePullPolicy: "IfNotPresent" | "Always";
    securityContext?: ISecurityContext;
    args?: string[];
    command?: string[];
    env?: Array<IEnvVar>;
    volumeMounts?: Array<IVolumeMount>;
    mountProductionConfig?: boolean;
    resources?: ResourceSpec
    runOnStaging?: boolean
}

export interface ISecret {
    secretName: string;
}

export interface IVolume {
    name: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    emptyDir?: Object;
    secret?: ISecret;
}

export interface ICronjobDefinition {
    branch: string;
    name: string;
    backoffLimit?: number;
    namespace: string;
    activeDeadlineSeconds?: number;
    schedule: ICronSchedule;
    initContainers?: Array<ICronjobContainer>;
    shareProcessNamespace?: boolean;
    volumes?: Array<IVolume>;
    containers: Array<ICronjobContainer>;
    restartPolicy?: "Always" | "OnFailure" | "Never";
    concurrencyPolicy: "Allow" | "Replace" | "Forbid";
}

const mapToK8sContainer = (container: ICronjobContainer) => {
    const containerSpec = {
        name: container.name,
        image: container.image,
    };
    if (container.command) {
        containerSpec["command"] = container.command;
    }
    if (container.args) {
        containerSpec["args"] = container.args;
    }
    if (container.env) {
        containerSpec["env"] = container.env;
    }
    if (container.securityContext) {
        containerSpec["securityContext"] = container.securityContext;
    }
    if (container.resources) {
        containerSpec["resources"] = container.resources
    }
    const volumeMounts = container.volumeMounts || [];
    if (container.mountProductionConfig) {
        volumeMounts.push(
            {
                mountPath: "/etc/binders",
                name: "production-secret",
                readOnly: true
            }
        );
    }
    if (volumeMounts.length > 0) {
        containerSpec["volumeMounts"] = volumeMounts;
    }

    if (container.runOnStaging) {
        if (!Array.isArray(containerSpec["env"])) {
            containerSpec["env"] = [];
        }
        containerSpec["env"].push({
            name: "BINDERS_ENV",
            value: "staging"

        })
    }
    return containerSpec;
}

export const buildCronJob = (definition: ICronjobDefinition) => {
    const allContainersSpec = {
        containers: definition.containers.map(mapToK8sContainer),
        restartPolicy: "Never"
    }
    const initContainers = definition.initContainers || [];
    const mountProductionConfig = any(c =>
        c.mountProductionConfig, [...definition.containers, ...initContainers]
    );
    const volumes = definition.volumes || [];
    if (mountProductionConfig) {
        volumes.push({
            name: "production-secret",
            secret: {
                secretName: getConfigSecret(definition.branch)
            }
        });
    }
    if (volumes.length > 0) {
        allContainersSpec["volumes"] = volumes;
    }
    if (initContainers.length > 0) {
        allContainersSpec["initContainers"] = initContainers.map(mapToK8sContainer);
    }
    if (definition.shareProcessNamespace) {
        allContainersSpec["shareProcessNamespace"] = definition.shareProcessNamespace;
    }
    if (definition.restartPolicy) {
        allContainersSpec["restartPolicy"] = definition.restartPolicy;
    }

    const jsonObject = {
        apiVersion: "batch/v1",
        kind: "CronJob",
        metadata: {
            name: definition.name,
            namespace: definition.namespace
        },
        spec: {
            schedule: stringifySchedule(definition.schedule),
            concurrencyPolicy: definition.concurrencyPolicy,
            jobTemplate: {
                spec: {
                    completions: 1,
                    template: {
                        spec: allContainersSpec
                    }
                }
            },
            successfulJobsHistoryLimit: 1,
            failedJobsHistoryLimit: 1
        }
    };
    if (definition.backoffLimit !== undefined) {
        jsonObject.spec.jobTemplate.spec["backoffLimit"] = definition.backoffLimit;
    }
    if (definition.activeDeadlineSeconds) {
        jsonObject.spec.jobTemplate.spec["activeDeadlineSeconds"] = definition.activeDeadlineSeconds;
    }
    return jsonObject;
};

export const getCronJobs = async (namespace: string) => {
    const response = await getKubeCtlDecodedJson(["get", "cronjob", "-n", namespace]);
    return response.items;
};
