/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Command, ICommandOptions } from "../../lib/commands";

export interface ITunnelSpec {
    namespace?: string;
    pod: string;
    localPort: number;
    remotePort: number;
    options?: Partial<ICommandOptions>;
}

const buildTunnelCommand = (spec: ITunnelSpec): Command => {
    const args = [
        "port-forward", spec.pod, `${spec.localPort}:${spec.remotePort}`
    ];
    if (spec.namespace) {
        args.push("-n", spec.namespace);
    }
    const commandOptions = spec.options || {};
    return new Command("kubectl", args, commandOptions);
};


export const withTunnel = async (spec: ITunnelSpec, action: () => Promise<void>) => (
    withMultiTunnel([spec], action)
);

export const withMultiTunnel = async (specs: ITunnelSpec[], action: () => Promise<void>) => {
    const commands = specs.map(buildTunnelCommand);
    try {
        commands.forEach(command => command.runInBackground());
        await action();
    } finally {
        commands.forEach(command => command.kill());
    }
};