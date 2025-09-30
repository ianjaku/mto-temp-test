/* eslint-disable no-console */
import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { base64decode } from "../../lib/base64";
import { createKubeConfig } from "../../actions/k8s-client/util";
import fetch from "node-fetch";
import { fetchOnePasswordSecrets } from "../../actions/op";
import { getK8SSecret } from "../../actions/k8s/secrets";
import { handleAsyncWithErrorLog } from "../../lib/utils";
import { main } from "../../lib/program";

const GRAFANA_URL = "http://grafana.monitoring.svc.cluster.local/api/admin/users";

interface User {
    name: string;
    email: string;
    login: string;
    password?: string;
}

interface ICreateGrafanaUsersOptions {
    clusterName: string;
    namespace: string;
}

async function createUser(authorizationHeader: string, user: User): Promise<void> {
    try {
        const response = await fetch(GRAFANA_URL, {
            method: "POST",
            headers: {
                "Authorization": authorizationHeader,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(user)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create user: ${JSON.stringify(errorData)}`);
        }

        console.log("User created successfully:", await response.json());
    } catch (error) {
        console.error(error.message);
    }
}

async function getAuthorizationHeader(namespace: string) {
    const secretName = "grafana"
    const secret = await getK8SSecret(secretName, namespace)
    const username = secret?.data["admin-user"];
    const password = secret?.data["admin-password"]
    if (!username || !password) {
        throw new Error("Can't get grafana admin password")
    }
    return "Basic " + Buffer.from(base64decode(username) + ":" + base64decode(password)).toString("base64")
}

function getEmailForUser(username: string): string {
    const mailMapping = {
        "dieter": "dieter@manual.to",
        "ian": "ian@manual.to",
        "octavian": "octavian.genes@manual.to",
        "peter": "peter.laca@manual.to",
        "tom": "tom@manual.to",
        "waldek": "waldek@manual.to"
    }
    const mail = mailMapping[username.toLowerCase()]
    if (!mail) {
        throw new Error(`Missing email for user ${username}`)
    }
    return mail
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        clusterName: {
            long: "cluster-name",
            short: "c",
            description: "The name of the kubernetes cluster",
            kind: OptionType.STRING,
            required: true
        },
        namespace: {
            long: "namespace",
            short: "n",
            description: "The name of the elastic cluster",
            kind: OptionType.STRING,
            default: "monitoring"
        }
    };
    const parser = new CommandLineParser("ICreateGrafanaUsersOptions", programDefinition);
    // tslint:disable-next-line:no-any
    return (<unknown>parser.parse()) as ICreateGrafanaUsersOptions;
};


main(async () => {
    const { clusterName, namespace } = getOptions()
    const kubeConfig = await createKubeConfig(clusterName, { useAdminContext: true });
    const users = await handleAsyncWithErrorLog(fetchOnePasswordSecrets, kubeConfig, "grafana", namespace)
    const authorizationHeader = await handleAsyncWithErrorLog(getAuthorizationHeader, namespace)

    for (const user of users) {
        const { password, username } = user
        const userConfig = {
            name: username,
            login: username,
            email: getEmailForUser(username),
            password: password.replace(/\s+/g, "")
        }
        await createUser(authorizationHeader, userConfig)
    }
});