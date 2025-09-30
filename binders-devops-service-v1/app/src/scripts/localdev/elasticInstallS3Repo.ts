import { buildAndRunCommand, buildKubeCtlCommand } from "../../lib/commands";
import { main } from "../../lib/program";

const doIt = async () => {
    await buildAndRunCommand( () => buildKubeCtlCommand([
        "exec",
        "elastic",
        "-n",
        "develop",
        "--",
        "/usr/share/elasticsearch/bin/elasticsearch-plugin",
        "install",
        "--batch",
        "repository-s3"
    ]));
    const { output: dockerPsOutput } = await buildAndRunCommand( () => ({
        command: "docker",
        args: [
            "ps",
            "--filter", "ancestor=elasticsearch:5.6",
            "--format", "{{.ID}}"
        ]
    }));
    const psLines = dockerPsOutput.split("\n").filter(l => !!l.trim());
    if (psLines.length !== 1) {
        throw new Error("Could not find docker id of elasticsearch container");
    }
    await await buildAndRunCommand( () => ({
        command: "docker",
        args: [ "restart", psLines[0]]
    }));
};

main(doIt);