import { getDevopsConfig } from "../../lib/config";

const DEFAULT_RECEIVER = "default-receiver";
const APP_ALERT_RECEIVER = "application-alert-receiver";
const INFRA_ALERT_RECEIVER = "infra-alert-receiver";
const WAF_ALERT_RECEIVER = "waf-alert-receiver";
const SLACK_CRITICAL_RECEIVER = "slack-critical-receiver";
const PAGER_DUTY_RECEIVER = "pager-duty"
const PAGER_DUTY_ALERTS = ["MONGO Up", "ES Cluster binders Green", "ES No Data binders", "REDIS Up"]
const ALERT_RESPONSE_DOC_URL = "https://bindersmedia.atlassian.net/wiki/spaces/SD/pages/227803137/Alert+Responses"
const KIBANA_URL = "https://kibana.binders.media"

export type AlertCategory = "application" | "infra" | "waf"
export type Severity = "critical" | "warning"
export function setAlertLabels(category: AlertCategory, severity: Severity = "warning"): { labels: { category: AlertCategory, severity: Severity } } {
    return {
        labels: {
            category: category,
            severity
        }
    }
}

const getPagerDutyRoute = (alertname: string) => ({
    continue: true,
    match: {
        alertname
    },
    receiver: PAGER_DUTY_RECEIVER
})

const getRoute = () => {
    return {
        group_by: ["alertname"],
        receiver: DEFAULT_RECEIVER,
        group_interval: "1m",
        routes: [
            {
                receiver: DEFAULT_RECEIVER,
                continue: true
            },
            {
                match: {
                    alertname: "APP Cronjob failure"
                },
                repeat_interval: "30m"
            },
            {
                continue: true,
                match: {
                    category: "application"
                },
                receiver: APP_ALERT_RECEIVER,
            },
            {
                continue: true,
                match: {
                    category: "infra"
                },
                receiver: INFRA_ALERT_RECEIVER,
            },
            {
                continue: true,
                match: {
                    category: "waf"
                },
                receiver: WAF_ALERT_RECEIVER,
            },

            {
                continue: true,
                match: {
                    severity: "critical"
                },
                receiver: SLACK_CRITICAL_RECEIVER,
            },
            {
                continue: true,
                match: {
                    severity: "critical"
                },
                receiver: PAGER_DUTY_RECEIVER
            },
            ...PAGER_DUTY_ALERTS.map(getPagerDutyRoute)
        ]
    };
};

type SlackReceiverConfig = {
    channel: string
    name: string
    url: string
}

const createSlackActionButton = (url: string, text: string) => ({
    url,
    text,
    type: "button"
})
const createSlackReceiver = (config: SlackReceiverConfig) => {
    const { channel, name, url } = config
    const actions = []
    actions.push(createSlackActionButton(ALERT_RESPONSE_DOC_URL, "Alert responses :green_book:"))
    actions.push(createSlackActionButton(KIBANA_URL, "Kibana :mag:"))
    return {
        name,
        slack_configs: [
            {
                api_url: url,
                channel,
                send_resolved: true,
                title: "{{ template \"slack.binders.title\" . }}",
                text: "{{ template \"slack.binders.text\" . }}",
                actions
            }
        ],
    }
}

const getPagerDuty = async () => {
    const devopsConfig = await getDevopsConfig()
    const integrationKey = devopsConfig.pagerDuty?.integrationKey
    if (integrationKey) {
        return {
            service_key: integrationKey
        }
    }
    return {};
}

const getReceivers = async () => {
    const devopsConfig = await getDevopsConfig();
    const { appAlerts, criticalAlerts, infraAlerts, wafAlerts, prometheus } = devopsConfig.slack
    const receivers = []
    receivers.push(createSlackReceiver({
        channel: "#prometheus",
        name: DEFAULT_RECEIVER,
        url: prometheus
    }))
    receivers.push(createSlackReceiver({
        channel: "#application-alerts",
        name: APP_ALERT_RECEIVER,
        url: appAlerts
    }))
    receivers.push(createSlackReceiver({
        channel: "#critical-alerts",
        name: SLACK_CRITICAL_RECEIVER,
        url: criticalAlerts
    }))
    receivers.push(createSlackReceiver({
        channel: "#infrastructure-alerts",
        name: INFRA_ALERT_RECEIVER,
        url: infraAlerts
    }))
    receivers.push(createSlackReceiver({
        channel: "#waf-alerts",
        name: WAF_ALERT_RECEIVER,
        url: wafAlerts
    }))

    return [
        ...receivers,
        {
            name: PAGER_DUTY_RECEIVER,
            pagerduty_configs: [
                await getPagerDuty()
            ]
        }
    ];
};

export const getSlackCustomTemplates = (): string => {
    return `{{ define "__alert_severity_prefix_title" -}}
    {{ if ne .Status "firing" -}}
    :ok:
    {{- else if eq .CommonLabels.severity "critical" -}}
    :fire:
    {{- else if eq .CommonLabels.severity "warning" -}}
    :warning:
    {{- else if eq .CommonLabels.severity "info" -}}
    :information_source:
    {{- else -}}
    :question:
    {{- end }}
{{- end }}

{{ define "slack.binders.title" -}}
    [{{ .Status | toUpper -}}
    {{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{- end -}}
    ] {{ template "__alert_severity_prefix_title" . }} {{ .CommonLabels.alertname }}
{{- end }}



{{ define "slack.binders.text" -}}
{{ range .Alerts }}
    *Severity*: \`{{ .Labels.severity }}\`
    *Description:* {{ .Annotations.description }}
    *Details:*
    {{ range .Labels.SortedPairs }} • *{{ .Name }}:* \`{{ .Value }}\`
    {{ end }}
    {{- end }}
{{- end }}`
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getProductionConfig = async () => {
    return {
        global: {
            resolve_timeout: "60m",
        },
        route: getRoute(),
        receivers: await getReceivers(),
    };
};


export const getStagingConfig = async () => {
    const devopsConfig = await getDevopsConfig();
    const { prometheusStaging } = devopsConfig.slack
    const receivers = []
    receivers.push(createSlackReceiver({
        channel: "#prometheus-staging",
        name: DEFAULT_RECEIVER,
        url: prometheusStaging
    }))
    return {
        global: {
            resolve_timeout: "60m",
        },
        route: {
            group_by: ["alertname"],
            receiver: DEFAULT_RECEIVER,
            group_interval: "1m",
            routes: [
                {
                    receiver: DEFAULT_RECEIVER,
                    continue: true
                }
            ]
        },
        receivers,
    };
};


