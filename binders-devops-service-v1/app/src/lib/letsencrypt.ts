import { STATIC_PAGE_DOMAINS } from "./staticsites";
import { WILDCARD_DOMAINS } from "@binders/client/lib/devops/domains";
import log from "./logging";




export const runCertBotManually = async (): Promise<void> => {
    const args = [
        "certonly", "--manual", // "-n",
        "--server", "https://acme-v02.api.letsencrypt.org/directory",
        "--preferred-challenges", "dns",
        "-d", `'${WILDCARD_DOMAINS.join(",")}'`
    ];
    log(`Please run this command: \n\nsudo certbot-auto ${args.join(" ")}\n`);
    // await runCommand("certbot-auto", args);
    // https://noobient.com/2018/04/10/free-wildcard-certificates-using-azure-dns-lets/
};


export const runCertBotManuallyStatic = async (): Promise<void> => {
    const args = [
        "certonly", "--manual", // "-n",
        "--server", "https://acme-v02.api.letsencrypt.org/directory",
        "--preferred-challenges", "dns",
        "-d", `'${STATIC_PAGE_DOMAINS.join(",")}'`
    ];
    log(`Please run this command: \n\nsudo certbot-auto ${args.join(" ")}\n`);
    // await runCommand("certbot-auto", args);
    // https://noobient.com/2018/04/10/free-wildcard-certificates-using-azure-dns-lets/
};
