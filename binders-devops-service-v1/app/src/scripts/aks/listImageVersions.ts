import { CommandLineParser, IProgramDefinition, OptionType } from "../../lib/optionParser";
import { listImageVersions } from "../../actions/aks/registry";
import { main } from "../../lib/program";

interface IListImageOptions {
    resourceGroup: string;
    registryName: string;
    imageName: string;
}

const getOptions = () => {
    const programDefinition: IProgramDefinition = {
        registryName: {
            long: "registry-name",
            description: "The name of the ACR",
            kind: OptionType.STRING,
            required: true
        },
        imageName: {
            long: "image-name",
            description: "The name of the image",
            kind: OptionType.STRING,
            required: true
        }
    };

    const parser = new CommandLineParser("listImageVersions", programDefinition);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any> parser.parse()) as IListImageOptions;
};

main( async () => {
    const { registryName, imageName } = getOptions();
    const versions = await listImageVersions(registryName, imageName);
    // eslint-disable-next-line no-console
    console.log("Got versions ", versions);
});


