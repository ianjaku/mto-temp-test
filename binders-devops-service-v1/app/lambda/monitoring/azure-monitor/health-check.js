const DEFAULT_REGION = "West Europe"
const SERVICE_ISSUE_EVENT_TYPE = "ServiceIssue"
const CRUCIAL_AZURE_SERVICES = [
    "App Service",
    "Azure Kubernetes Service (AKS)",
    "Storage",
    "Backup"
] // todo find correct names of other services (e.g media service)



//isCrucialServiceImpacted: Impact[] => boolean
function isCrucialServiceImpacted(impacts) {
    for (const impact of impacts) {
        if (CRUCIAL_AZURE_SERVICES.includes(impact.impactedService)) {
            return true
        }
    }
    return false
}


//isWestEuropeRegionImpacted: Impact[] => boolean
function isWestEuropeRegionImpacted(impacts) {
    for (const impact of impacts) {
        const westEuropeImpacted = (impact.impactedRegions.filter(region => region.impactedRegion === DEFAULT_REGION)).length > 0
        if (westEuropeImpacted) {
            return true
        }
    }
    return false
}

//areManualtoAzureCoreServicesHealthy: AzureHealthResponse => boolean
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function areManualtoAzureCoreServicesHealthy({ value }) {
    if (!value || value.length === 0) {
        return true
    }
    for (const event of value) {
        const crucialServiceImpacted = isCrucialServiceImpacted(event.properties.impact)
        const serviceIssue = event.properties.eventType === SERVICE_ISSUE_EVENT_TYPE
        const westEuropeImpacted = isWestEuropeRegionImpacted(event.properties.impact)

        if (crucialServiceImpacted && serviceIssue && westEuropeImpacted) {
            return false
        }
    }
    return true
}

//exports.areManualtoAzureCoreServicesHealthy = areManualtoAzureCoreServicesHealthy
// export function square(x) {
//     return x * x
// }

/*
export interface AzureHealthResponse {
    value: HealthEvent[]
}

export enum EvenType {
    ServiceIssue = "ServiceIssue"
}

interface ImpactedRegions {
    impactedRegion: string;
    impactedSubscriptions: string[]
}

interface Impact {
    impactedService: string
    impactedRegions: ImpactedRegions[]
}

interface HealthEventProperties {
    eventType: EvenType
    impact: Impact[]
}

export interface HealthEvent {
    properties: HealthEventProperties
}
*/