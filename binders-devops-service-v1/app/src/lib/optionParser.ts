/* eslint-disable no-console */
import { Command } from "commander";

export enum OptionType {
    INTEGER, FLOAT, STRING, BOOLEAN
}

export interface IOptionDefinition {
    short?: string;
    long: string;
    kind: OptionType;
    required?: boolean;
    description: string;
    default?: number | string | boolean;
}

export interface IParserLogger {
    log(message: unknown): void;
    error(error: unknown): void;
}

class DefaultLogger implements IParserLogger {
    log(message: unknown): void {
        console.log(message);
    }
    error(error: unknown): void {
        console.error(error);
    }
}

const defaultLoggerInstance = new DefaultLogger();


export interface IProgramDefinition {
    [key: string]: IOptionDefinition;
}

export class CommandLineParser<T extends IProgramDefinition> {

    private command: Command;

    constructor(
        readonly name: string,
        readonly optionDefinitions: T,
        private readonly logger: IParserLogger = defaultLoggerInstance
    ) {
        let command = new Command(name);
        for (const key in this.optionDefinitions) {
            command = this.addOption(command, key, this.optionDefinitions[key]);
        }
        this.command = command;
    }

    private optionWithValue(dashedOption: string, optionName: string, optionType: OptionType) {
        switch (optionType) {
            case OptionType.BOOLEAN:
                return dashedOption;
            default:
                return `${dashedOption} [${optionName}]`;
        }
    }

    private getParser(optionType: OptionType) {
        switch (optionType) {
            case OptionType.INTEGER:
                return parseInt;
            default:
                return undefined;
        }
    }

    private addOption(command: Command, optionKey: string, option: IOptionDefinition): Command {
        const dashedPrefix = option.short ? `-${option.short}, ` : "";
        const dashed = `${dashedPrefix}--${option.long}`;
        const withKind = this.optionWithValue(dashed, optionKey, option.kind);
        const parser = this.getParser(option.kind);
        const descriptionSuffixParts: string[] = [];
        if (option.required) {
            descriptionSuffixParts.push("required");
        }
        if (option.default) {
            descriptionSuffixParts.push(`default: ${option.default}`);
        }
        const descriptionSuffix = descriptionSuffixParts.length > 0 ?
            ` (${descriptionSuffixParts.join(", ")})` :
            "";
        const description = option.description + descriptionSuffix;
        return command.option(withKind, description, parser);
    }

    parse<RT extends { [P in keyof T]?: unknown }>(): RT {
        const options = this.command.parse(process.argv);
        this.ensureNoMissingOptions(options);

        const result: Record<string, unknown> = {};
        for (const [key, definition] of Object.entries(this.optionDefinitions)) {
            const paramValue = options[key] ?? definition.default;
            if (paramValue !== undefined) {
                result[key] = paramValue;
            }
        }
        return result as RT;
    }

    private ensureNoMissingOptions(options: Command) {
        const missingOptions = Object.entries(this.optionDefinitions)
            .filter(([key, definition]) =>
                definition.required && definition.default === undefined && (
                    options[key] === undefined ||
                    (definition.kind !== OptionType.BOOLEAN && options[key] === true)
                ))
            .map(([_, definition]) => `--${definition.long}`)

        if (missingOptions.length === 0) {
            return;
        }
        this.logger.log("\n");
        this.logger.error(`\nMissing some required option or value: ${missingOptions.join(",")}`);
        this.command.outputHelp();
        this.logger.log("\n\n");
        process.exit(1);
    }
}

