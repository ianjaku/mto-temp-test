import { setAlertLabels } from "./alertmgr"

const getManualtoRules = () => {
    return [
        {
            alert: "Manualto corporate site is down",
            expr: "avg_over_time(manualto_corp_site_monitor{}[5m]) < 0.5",
            annotations: {
                summary: "Company website down",
                description: "Please check manual.to status and hosting."
            },
            ...setAlertLabels("application")
        }
    ]
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const getManualtoRulesGroup = () => ({
    name: "manualto.rules",
    rules: getManualtoRules()
})