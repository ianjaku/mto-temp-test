import { BINDERS_SERVICE_SPECS } from "../../config/services";
import { PRODUCTION_NAMESPACE } from "../../lib/bindersenvironment";
import { setAlertLabels } from "./alertmgr";

const missingServiceAlerts = (spec) => {
    const serviceName = `${spec.name}-${spec.version}`;
    const k8sServiceName = `${serviceName}-service`;
    return [
        {
            alert: `APP Missing Endpoint ${serviceName}`,
            expr: `(kube_endpoint_address_available{endpoint="${k8sServiceName}", namespace="${PRODUCTION_NAMESPACE}"} / kube_endpoint_address_available{endpoint="${k8sServiceName}", namespace="${PRODUCTION_NAMESPACE}"} offset 5m) < 0.8`,
            annotations: {
                summary: `The available endpoint addresses for the service ${serviceName} in the production namespace have dropped below 80% compared to 5 minutes ago. This could indicate that some instances of the service are not reachable or have been scaled down unexpectedly`,
                description: `Endpoint count for ${serviceName} has dropped below 80% of the previous count within the last 5 minutes`
            },
            for: "5m",
            ...setAlertLabels("infra")
        },
        {
            alert: `APP Absent Endpoint ${serviceName}`,
            expr: `absent(kube_endpoint_address_available{endpoint="${k8sServiceName}", namespace="${PRODUCTION_NAMESPACE}"}) > 0`,
            annotations: {
                summary: `No endpoints available for ${serviceName}`,
                description: `There are no available endpoint addresses for service ${serviceName} in the ${PRODUCTION_NAMESPACE} namespace. This suggests that the service is unavailable. Immediate action is required to restore service functionality.`
            },
            ...setAlertLabels("infra", "critical")
        }
    ];

};

const getSslCertificateAlertObject = () => {
    return {
        alert: "APP SSL certificate validity",
        expr: "manualto_tls_cert_remaining_days < 14",
        annotations: {
            summary: "SSL certificate is expiring in less than 14 days",
            description: "The SSL certificate for the application is expiring in less than 14 days. Immediate renewal is recommended to prevent service interruption."
        },
        ...setAlertLabels("application")
    }
}

const failedCronJobAlertsObject = () => {
    return {
        alert: "APP Cronjob failure",
        expr: "kube_job_failed{} > 0",
        annotations: {
            summary: "One or more CronJobs have failed",
            description: "A Kubernetes job {{ $labels.job_name }} has failed. Review the logs to identify the cause and ensure that the job is functioning correctly."
        },
        ...setAlertLabels("application")
    };
}

const htmlSanitationAlertObject = () => (
    {
        alert: "APP HTML Sanitation",
        expr: "increase(manualto_html_sanitizer_stripped_html[10m]) > 0",
        annotations: {
            summary: "HTML sanitizer stripped HTML content",
            description: "The HTML sanitizer has stripped unsafe HTML content in the last 10 minutes. Review the input source to ensure it is safe and functioning as expected."
        },
        ...setAlertLabels("application")
    }
)

const visualsInErrorStateObject = () => (
    {
        alert: "APP Visual processing error",
        expr: "rate(manualto_visuals_status_total{status=\"error\"}[10m]) > 0",
        annotations: {
            summary: "Visual processing errors detected",
            description: "One or more visual processing errors have been detected in the last 10 minutes. Investigate the visual processing pipeline for potential issues."
        },
        ...setAlertLabels("application")
    }
)

const visualsInProcessingBackgroundStateObject = () => (
    {
        alert: "APP Visual processing error",
        expr: "rate(manualto_visuals_status_total{status=\"processing-background\"}[10m]) > 0",
        annotations: {
            summary: "Visuals stuck in 'processing-background' state",
            description: "One or more visuals are stuck in the 'processing-background' state for more than 10 minutes. This may indicate issues in the background processing pipeline."
        },
        ...setAlertLabels("application")
    }
)


const getAppAlertRules = () => {
    const missingServiceAlertsObjects = BINDERS_SERVICE_SPECS
        .filter(spec => !spec.sharedDeployment)
        .reduce(
            (reduced, spec) => [...reduced, ...missingServiceAlerts(spec)],
            []
        );

    return [
        ...missingServiceAlertsObjects,
        getSslCertificateAlertObject(),
        failedCronJobAlertsObject(),
        htmlSanitationAlertObject(),
        visualsInErrorStateObject(),
        visualsInProcessingBackgroundStateObject()
    ];
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getAppAlertRulesGroup = () => {
    return {
        name: "app.rules",
        rules: getAppAlertRules()
    };
};