import { ILogEntry, parseLog } from "../../actions/nginx/parser";
import { listPods } from "../../actions/k8s/pods"
import log from "../../lib/logging"
import { main } from "../../lib/program"
import { runCommand } from "../../lib/commands"

function filterHttp500(entry: ILogEntry): boolean {
    return entry.statusCode >= 502;
}

function filterHttp400(entry: ILogEntry): boolean {
    return entry.statusCode >= 400 && entry.statusCode < 500
}

function filterHttp400And500(entry: ILogEntry): boolean {
    return entry.statusCode >= 400
}

const filterErrorMapper = {
    "all": filterHttp400And500,
    "client": filterHttp400,
    "server": filterHttp500
}

async function processLocalFile(localFilePath: string, filter: (ILogEntry) => boolean): Promise<ILogEntry[]> {
    // eslint-disable-next-line no-console
    console.log(`Processing ${localFilePath}`);
    const entries = await parseLog(localFilePath, { verbose: false });
    return entries.filter(filter);
}

async function getNginxPods(): Promise<string[]> {
    const pods = await listPods("ingress-nginx-controller-", "ingress");
    return pods.map(p => p.metadata.name);
}

type FilterType = "all" | "client" | "server"
function getOptions(): FilterType {
    if (process.argv.length !== 3) {
        log(`Usage: node ${__filename} <filter_opotion> where filter option is: (all, client, server)`);
        return "all"
    }
    const input = process.argv[2]
    return input === "all" || input === "client" || input === "server" ? input : "all"
}

main(async () => {
    const option = getOptions()
    const filter = filterErrorMapper[option]
    const pods = await getNginxPods();
    for (const pod of pods) {
        const fileName = `/tmp/${pod}.log`
        await runCommand("kubectl", ["-n", "ingress", "logs", pod, ">", fileName], { shell: true });
        const entries = await processLocalFile(fileName, filter);
        for (let i = 0; i < entries.length; i++) {
            log(JSON.stringify(entries[i]));
        }
    }
})