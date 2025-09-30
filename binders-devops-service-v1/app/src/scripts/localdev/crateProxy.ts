import { BINDERS_SERVICE_SPECS, IServiceSpec } from "../../config/services";
import { dumpFile } from "../../lib/fs";
import { join } from "path";
import log from "../../lib/logging";
import { main } from "../../lib/program";
import { tmpdir } from "os";
import { toNodePort } from "../../lib/devenvironment";
import { v4 } from "uuid";


const serviceToLocation = (spec: IServiceSpec): string => {
    return `
    location ~ ^/manual/api/${spec.name}/${spec.version}/(.*) {
        proxy_set_header X-Manualto-Forwarded-Host localhost:9998;
        proxy_pass http://172.17.0.1:${toNodePort(spec.port)}/${spec.name}/${spec.version}/$1?$query_string;
        break;
    }`
};


const getReaderLocation = (credentials) => {
    const encodedCredentials = Buffer
        .from(`${credentials.login}:${credentials.password}`)
        .toString("base64");
    return `
    location ~ ^/manual/reader/?(.*) {
        proxy_set_header Authorization "Basic ${encodedCredentials}";
        proxy_set_header X-Manualto-Forwarded-Host localhost:9998;
        proxy_pass http://172.17.0.1:30014/$1?$query_string;
        break;
    }`

};

const getNginxLocations = (credentials): string[] => {
    const serviceLocations = BINDERS_SERVICE_SPECS
        .filter(spec => !spec.isFrontend)
        .map(serviceToLocation);
    return [
        getReaderLocation(credentials),
        ...serviceLocations
    ]
};

const getNginxFileContents = (credentials) => {
    const header = `
server {
    listen      80;
    root        /var/www;
`;
    const locations = getNginxLocations(credentials);
    const footer = `
}
`;
    return `${header}${locations.join("\n")}${footer}`;
}

const writeNginxConfigFile = async (credentials) => {
    const filePath = join(tmpdir(), `${v4()}.conf`);
    const fileContents = getNginxFileContents(credentials);
    await dumpFile(filePath, fileContents);
    return filePath;
}
const doIt = async () => {
    const credentials = {
        login: "your_user",
        password: "your_password"
    }
    const configFileLocation = await writeNginxConfigFile(credentials);
    log(`Now run \n\ndocker run --rm --name manualto-proxy -p 9998:80 -v ${configFileLocation}:/etc/nginx/conf.d/default.conf nginx\n`)
}

main(doIt);