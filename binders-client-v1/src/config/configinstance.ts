import { ObjectConfig } from "./config";

const services = {};

if (typeof window !== "undefined") {
    const locations = window["bindersConfig"]?.api?.locations ?? {};
    for (const service in locations) {
        services[service] = {
            prefix: "/" + service,
            location: locations[service]
        };
    }
}

export const config = new ObjectConfig({ services });

export function getServiceLocation(serviceName: string): string {
    const bindersConfig = window["bindersConfig"];
    if (bindersConfig.api.locations[serviceName]) {
        return bindersConfig.api.locations[serviceName];
    } else {
        return bindersConfig.api.locations.default;
    }
}
