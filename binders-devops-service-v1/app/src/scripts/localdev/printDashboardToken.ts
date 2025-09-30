import { getK8SSecret, listSecrets } from "../../actions/k8s/secrets";
import { base64decode } from "../../lib/base64";
import { main } from "../../lib/program";

// kubectl -n kube-system describe secret $(kubectl -n kube-system get secret | grep admin-user | awk '{print $1}')

const getTokenSecretName = async () => {
    const secrets = await listSecrets("kube-system");
    const secret = secrets.find(s => s.metadata.name.startsWith("admin-user-token"));
    if (!secret) {
        throw new Error("Could not find admin token secret");
    }
    return secret.metadata.name;
};

const doIt = async () => {
    const secretName = await getTokenSecretName();
    const secret = await getK8SSecret(secretName, "kube-system");
    const token = base64decode(secret.data.token);
    // eslint-disable-next-line no-console
    console.log(token);
};

main(doIt);
