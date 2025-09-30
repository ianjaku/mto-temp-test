import { AlertCategory, setAlertLabels } from "./alertmgr";

enum HttpStatusGroups {
    Informational = "1xx",
    Successful = "2xx",
    Redirection = "3xx",
    ClientError = "4xx",
    ServerError = "5xx"
}

type WafMode = "Prevention" | "Detection"

const BAD_BOTS_RULEIDS = ["100100", "100200"]
const GOOD_BOTS_RULEIDS = ["200100", "200200"]
const UNKNOWN_BOTS_RULEIDS = ["300100", "300200", "300300", "300400", "300500", "300600", "300700"]
const ALL_BOTS_RULEIDS = [...BAD_BOTS_RULEIDS, ...GOOD_BOTS_RULEIDS, ...UNKNOWN_BOTS_RULEIDS]

const buildWafAlertExpr = (
    mode: WafMode,
    excludedRuleIds: string[] = []
): string => {
    const baseFilters = [
        "dimensionAction=\"Block\"",
        `dimensionMode="${mode}"`
    ];

    const exclusionFilters = excludedRuleIds.map(id => `dimensionRuleid!="${id}"`);

    const combinedFilters = [...baseFilters, ...exclusionFilters].join(",");

    return `rate(app_gw_azwafsecrule_total_count{${combinedFilters}}[10m]) > 0`;
};

const getRequestCountAlert = (category: AlertCategory, label: string, status: HttpStatusGroups, threshold: number) => {
    const expr = `sum by(dimensionBackendpool) (rate(app_gw_backendresponsestatus_total_count{dimensionHttpstatusgroup="${status}"}[5m])) > ${threshold}`
    return {
        alert: `APP Gateway INGRESS Requests HTTP ${label}`,
        expr,
        annotations: {
            summary: `High rate of HTTP ${status} errors in {{ $labels.dimensionBackendpool }}`,
            description: `The APP Gateway Ingress controller has detected a high rate of HTTP ${status} errors for in the {{ $labels.dimensionBackendpool }} services.`
        },
        ...setAlertLabels(category)
    };
};

const getBlockedRequestAlert = (category: AlertCategory) => {
    const expr = buildWafAlertExpr("Prevention", ALL_BOTS_RULEIDS)
    return {
        alert: "WAF blocked requests",
        expr,
        annotations: {
            summary: "Http requests blocked by rule {{ $labels.dimensionRuleid }}",
            description: "WAF policy on Azure App Gateway detect requests that violates rule {{ $labels.dimensionRuleid }} id from group {{ $labels.dimensionRulegroupid}}"
        },
        ...setAlertLabels(category)
    };
};

const getDetectedRequestAlert = (category: AlertCategory) => {
    const expr = buildWafAlertExpr("Detection", ALL_BOTS_RULEIDS)
    return {
        alert: "WAF detected requests",
        expr,
        annotations: {
            summary: "Http requests detected by rule {{ $labels.dimensionRuleid }}",
            description: "WAF policy on Azure App Gateway detect requests that violates rule {{ $labels.dimensionRuleid }} id from group {{ $labels.dimensionRulegroupid}}"
        },
        ...setAlertLabels(category)
    };
};


const getFailedRequestAlert = (category: AlertCategory, threshold: number) => {
    const expr = `rate(app_gw_failedrequests_total_count{}[10m]) > ${threshold}`
    return {
        alert: "APP Gateway failed requests",
        expr,
        annotations: {
            summary: "Http requests failed by rule {{ $labels.dimensionRuleid }}",
            description: "WAF policy on Azure App Gateway detect high rate of failed requests"
        },
        ...setAlertLabels(category)
    };
};

const getRequestCountAlerts = () => {
    return [
        getRequestCountAlert("application", "Client Error", HttpStatusGroups.ClientError, 0.1),
        getRequestCountAlert("application", "Server Error", HttpStatusGroups.ServerError, 0.1)
    ];
};

const getIngressAlertRules = () => {
    return [
        ...getRequestCountAlerts(),
        getBlockedRequestAlert("waf"),
        getDetectedRequestAlert("waf"),
        getFailedRequestAlert("infra", 0.1)
    ];
};

export const getAzureAppGatewayIngressAlertRulesGroup = () => ({
    name: "azure-ingress.rules",
    rules: getIngressAlertRules()
});