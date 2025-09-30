import { DistinctQuestion } from "inquirer";
import { Service } from "../shared/contract";
import inquirer from "inquirer";
import { insertEndpoint } from "./insert";

export interface Endpoint {
    service: Service,
    name: string,
    description: string,
    method: string,
    params: Param[],
    returnType: string,
}

export type ParamSource = "path" | "body" | "query";

export interface Param {
    name: string,
    source: ParamSource,
    required: boolean,
    type: string,
}



const questions1: DistinctQuestion[] = [
    {
        type: "list",
        name: "service",
        message: "In which service?",
        choices: [
            "account",
            "authorization",
            "credential",
            "image",
            "notification",
            "public-api",
            "repository",
            "routing",
            "tracking",
            "user",
        ]
    },
    {
        type: "input",
        name: "name",
        message: "Enter then name of the endpoint, eg. listAccounts:",
        validate(value: string) {
            const valid = !!value;
            return valid || "Please enter an endpoint name";
        },
    },
    {
        type: "input",
        name: "description",
        message: "Enter then description of the endpoint:",
        default: "TODO",
    },
    {
        type: "list",
        name: "method",
        message: "Select a method",
        choices: ["POST", "GET", "PUT", "DELETE"],
        default: "POST",
    },
    {
        type: "input",
        name: "paramsNamesCsv",
        message: "Enter the params (csv), eg. accountId,binderId:",
    },
];


function buildParamSourcesQuestion(paramNames: string[]): DistinctQuestion[] {
    return [
        {
            type: "table",
            name: "paramSources",
            message: "Parameter sources",
            columns: [
                {
                    name: "body",
                    value: "body",
                },
                {
                    name: "path",
                    value: "path",
                },
                {
                    name: "query",
                    value: "query",
                },
            ],
            rows: paramNames.map((name, i) => ({
                name,
                value: i,
            })),
            pageSize: 99,
        }
    ] as unknown as DistinctQuestion[]
}

function buildParamRequiredsQuestion(paramNames: string[]): DistinctQuestion[] {
    return [
        {
            type: "table",
            name: "paramRequireds",
            message: "Parameter required/optional",
            columns: [
                {
                    name: "required",
                    value: "required",
                },
                {
                    name: "optional",
                    value: "optional",
                },
            ],
            rows: paramNames.map((name, i) => ({
                name,
                value: i,
            })),
            pageSize: 99,
        }
    ] as unknown as DistinctQuestion[]
}

function buildParamTypeQuestion(paramName: string): DistinctQuestion {
    return {
        type: "suggest",
        name: "type",
        message: `Enter the type of ${paramName}:`,
        suggestions: ["string", "number", "boolean", "void", "any", "Record<string, string>"],
    } as unknown as DistinctQuestion;
}

function buildParamTypesQuestion(paramNames: string[]): DistinctQuestion[] {
    return [
        {
            type: "table",
            name: "paramTypes",
            message: "Parameter types",
            columns: [
                {
                    name: "string",
                    value: "string",
                },
                {
                    name: "string[]",
                    value: "string[]",
                },
                {
                    name: "boolean",
                    value: "boolean",
                },
                {
                    name: "number",
                    value: "number",
                },
                {
                    name: "something else",
                    value: "else",
                }
            ],
            rows: paramNames.map((name, i) => ({
                name,
                value: i,
            })),
            pageSize: 99,
        }
    ] as unknown as DistinctQuestion[]
}

const questions2: DistinctQuestion[] = [
    {
        type: "suggest",
        name: "return type",
        message: "Enter a return type (will be wrapped in a Promise):",
        suggestions: ["string", "number", "boolean", "void", "any", "Record<string, string>"],
        default: "void",
    }
] as unknown as DistinctQuestion[];


export async function endpointPrompt(): Promise<void> {
    const { service, name, description, method, paramsNamesCsv } = await inquirer.prompt(questions1);
    const paramNames = paramsNamesCsv.split(",").filter(n => !!n);
    const { paramSources } = !paramNames.length ? { paramSources: [] } : await inquirer.prompt(buildParamSourcesQuestion(paramNames));
    const { paramRequireds } = !paramNames.length ? { paramRequireds: [] } : await inquirer.prompt(buildParamRequiredsQuestion(paramNames));
    const { paramTypes } = !paramNames.length ? { paramTypes: [] } : await inquirer.prompt(buildParamTypesQuestion(paramNames));

    const params = [];
    let i = 0;
    for (const paramName of paramNames) {
        const param: Param = {
            name: paramName,
            source: paramSources[i] || "body",
            required: paramRequireds[i] !== "optional",
            type: paramTypes[i] || "any",
        };
        if (param.type === "else") {
            const { type } = await inquirer.prompt([buildParamTypeQuestion(paramName)]);
            param.type = type || "any";
        }
        params.push(param);
        i++;
    }
    // put optional params last
    params.sort((a, b) => {
        if (a.required === b.required) {
            return 0;
        }
        return a.required ? -1 : 1
    });

    // flow to bootstrap new types / interfaces

    const { returnType } = await inquirer.prompt(questions2);

    const endpoint: Endpoint = {
        service,
        name,
        description,
        method,
        params,
        returnType: returnType || "void",
    }

    await insertEndpoint(endpoint);

    console.log(`Done! Next steps:
\t- In the client routes: add validation rules, tweak the successStatus
\t- In the service routes: add Authorization and Authentication as needed (currently backend-only)
\t- Implement the endpoint in service.ts
${endpoint.service === "image" ? "\t- Since this is the image service, some extra config is needed; check ImageServiceBuilder (service.ts) and ImageServiceContractBuilder (contract.ts)" : ""}
`);

}