
import {ObjectConfig} from "@binders/client/lib/config/config";

const services = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serviceLocations = (<any> window).bindersConfig.api.locations;
for (const serviceName in serviceLocations) {
    services[serviceName] = {
        prefix: "/" + serviceName,
        location: serviceLocations[serviceName]
    };
}
const objectConfig = new ObjectConfig({services});
export default objectConfig;