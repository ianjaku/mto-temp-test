import { dumpFile } from "./fs";
import { join } from "path";


export const CORPSITE_ALIAS_DOMAINS = [
    "binders.media",
    "manaul.to",
    "manualto.com",
    "manuel.to",
    "procedure.to",
    "sop.to",
]

const ALL_CORPSITE_ALIAS_DOMAINS = CORPSITE_ALIAS_DOMAINS
    .map(d => [d, `www.${d}`])
    .flat()

export const STATIC_PAGE_DOMAINS = [
    "telltree.com",
    "www.telltree.com",
    "indebanvandetijd.be",
    "www.indebanvandetijd.be",
    "indebanvandetijd.com",
    "www.indebanvandetijd.com",
    ...ALL_CORPSITE_ALIAS_DOMAINS
];


export async function createCorpSiteAliasesNginxConfig(
    repoRoot: string, serviceFolder: string): Promise<void> {
    const fileContents = `server {
    listen 8082;
    server_name ${ALL_CORPSITE_ALIAS_DOMAINS.join(" ")};
    location / {
        rewrite ^/(.*)$ https://manual.to/$1 redirect;
    }
}
`;
    await dumpFile(join(repoRoot, serviceFolder, "conf.d/corpsitealiases.conf"), fileContents);
}