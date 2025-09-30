/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/ban-types */
import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { getKubeCtlDecodedJson } from "../../lib/k8s";


export interface IK8SNode {
    name: string;
    labels: Object;
}

export const getK8SNodes = async (): Promise<IK8SNode[]> => {
    const nodes = await getKubeCtlDecodedJson(["get", "nodes"]);
    return nodes.items.map(node => {
        const { metadata } = node;
        const { name, labels } = metadata;
        return { name, labels };

    });
};

export const addLabel = async (nodeName, labels: Object, overwrite = false) => {
    const labelStrings = Object.keys(labels)
        .map(label => `${label}=${labels[label]}`);
    const args = ["label", "nodes", nodeName, ...labelStrings]

    if (overwrite) {
        args.push("--overwrite")
    }
    await getKubeCtlDecodedJson(args);
};

export const deleteLabel = async (nodeName: string, labelKey: string) => {
    await buildAndRunCommand(() => buildKubeCtlCommand(["label", "node", nodeName, `${labelKey}-`]), { mute: true });
};

export const isNodeLabelValueExists = async (labelValue: string): Promise<boolean> => {
    const nodes = await getK8SNodes();
    for (const node of nodes) {
        for (const labelKey in node.labels) {
            if (node.labels[labelKey] === labelValue) {
                return true
            }
        }
    }
    return false

}