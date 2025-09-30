import { copyContext } from "../../actions/k8s/kubectl";
import { main } from "../../lib/program";

const getOptions = () => {
    return {
        sourceFile: "/mnt/c/Users/Toms/.kube/config",
        targetFile: "/home/tom/.kube/config",
        context: "docker-for-desktop"
    };
};

const doIt = async () => {
    const { sourceFile, targetFile, context } = getOptions();
    await copyContext(sourceFile, targetFile, context);
};

main(doIt);