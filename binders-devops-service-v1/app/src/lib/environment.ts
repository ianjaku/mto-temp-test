import { CommandLineParser, IProgramDefinition, OptionType } from "./optionParser";

export type Env = "dev" | "staging" | "production" | "test"
export interface EnvironmentOption {
    env: string
    namespace?: string
    devops?: boolean
    dryRun?: boolean
}


export const isStaging = (): boolean => {
    return process.env.BINDERS_ENV === "staging";
};

export const isDev = (): boolean => {
    return process.env.NODE_ENV === "development";
};

export const isProduction = (): boolean => {
    return (
        process.env.NODE_ENV === "production" &&
        process.env.BINDERS_ENV !== "staging"
    );
};

export const parseEnv = (envi: string): Env => {
    if (envi === "production") {
        return "production"
    }
    if (envi === "staging") {
        return "staging"
    }
    if (envi === "dev") {
        return "dev"
    }
    if (envi === "test") {
        return "test"
    }
    throw new Error("Unknown environment")
}

export function isValidEnv(value: string): boolean {
    return ["dev", "staging", "production", "test"].includes(value);
}


export const getEnvironmentOptions = (namespaceRequired = false): EnvironmentOption => {
    const programDefinition: IProgramDefinition = {
        env: {
            long: "env",
            short: "e",
            kind: OptionType.STRING,
            description: "environment (dev, staging or production)",
            required: true
        },
        namespace: {
            long: "namespace",
            short: "n",
            kind: OptionType.STRING,
            description: "k8s namespace",
            required: namespaceRequired
        },
        devops: {
            long: "devops",
            short: "d",
            kind: OptionType.BOOLEAN,
            description: "Also include devops secret",
            required: false
        },
        dryRun: {
            long: "dryRun",
            kind: OptionType.BOOLEAN,
            description: "Only perform a dry run, don't change anything",
            default: false
        }
    }
    const parser = new CommandLineParser("EnvironmentOption", programDefinition)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (<any>parser.parse()) as EnvironmentOption
}