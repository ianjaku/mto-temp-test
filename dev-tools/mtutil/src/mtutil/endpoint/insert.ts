import { CodeBlockWriter, Project, ScriptTarget, SyntaxKind } from "ts-morph";
import { Endpoint, ParamSource } from "./prompt";
import { getClientPath, getServiceBasepath } from "../shared/contract";

function serviceClassRegexFromService(service: string): RegExp {
    const regexPart = (service === "repository" ? "bindersrepository" : service).replace(/-/g, "");
    return new RegExp(`^${regexPart}.*Service$`, "i");
}

export async function insertEndpoint(endpoint: Endpoint): Promise<void> {

    const paramsString = endpoint.params.map(p => `${p.name}${p.required ? "" : "?"}: ${p.type}`).join(", ");
    const returnType = `Promise<${endpoint.returnType}>`;

    const morphProject = new Project({
        compilerOptions: {
            target: ScriptTarget.ES2020,
        },
    });

    try {
        insertInContract(morphProject, endpoint, paramsString, returnType);
    } catch (e) {
        console.error("Error inserting in contract", e);
    }
    try {
        insertInClient(morphProject, endpoint, paramsString, returnType);
    } catch (e) {
        console.error("Error inserting in client", e);
    }

    try {
        insertInClientRoutes(morphProject, endpoint);
    } catch (e) {
        console.error("Error inserting in client routes", e);
    }

    try {
        insertInServiceRoutes(morphProject, endpoint);
    } catch (e) {
        console.error("Error inserting in service routes", e);
    }
    try {
        insertInService(morphProject, endpoint, paramsString, returnType);
    } catch (e) {
        console.error("Error inserting in service", e);
    }

    await morphProject.save();

}

async function insertInContract(morphProject: Project, endpoint: Endpoint, paramsString: string, returnType: string) {
    const write = writer => writer.writeLine(`${endpoint.name}(${paramsString}): ${returnType};`);
    const resourcePath = `../../binders-client-v1/src/clients/${getClientPath(endpoint.service)}/contract.ts`;
    const sourceFile = morphProject.addSourceFileAtPath(resourcePath);
    const serviceNamePartial = endpoint.service.replace(/-/g, "");
    const contractInterface = sourceFile.getInterface(i =>
        new RegExp(`${serviceNamePartial}.*Contract$`, "i").test(i.getName())
    )
    contractInterface.addMember(write);
}

async function insertInClient(morphProject: Project, endpoint: Endpoint, paramsString: string, returnType: string) {

    const pathParamsCsv = endpoint.params.filter(p => p.source === "path").map(p => p.name).join(", ");
    const bodyParamsCsv = endpoint.params.filter(p => p.source === "body").map(p => p.name).join(", ");
    const queryParamsCsv = endpoint.params.filter(p => p.source === "query").map(p => p.name).join(", ");

    const write = (writer: CodeBlockWriter) =>
        writer.write(`${endpoint.name}(${paramsString}): ${returnType}`).block(() => {
            writer.write(`return this.handleRequest("${endpoint.name}", `).block(() => {
                writer.conditionalWrite(!!pathParamsCsv, () => `pathParams: { ${pathParamsCsv} },`).newLineIfLastNot()
                    .conditionalWrite(!!bodyParamsCsv, () => `body: { ${bodyParamsCsv} },`).newLineIfLastNot()
                    .conditionalWrite(!!queryParamsCsv, () => `queryParams: { ${queryParamsCsv} },`)
            }).write(")");
        });

    const resourcePath = `../../binders-client-v1/src/clients/${getClientPath(endpoint.service)}/client.ts`;
    const sourceFile = morphProject.addSourceFileAtPath(resourcePath);
    const clientClass = sourceFile.getClass(c => c.getExtends().getText() === "BindersServiceClient");
    clientClass.addMember(write);

}

function insertInClientRoutes(morphProject: Project, endpoint: Endpoint) {

    const pathParams = endpoint.params.filter(p => p.source === "path");
    const pathParamsPath = pathParams.length ? `/${pathParams.map(p => `:${p.name}`).join("/")}` : "";
    const path = `/${endpoint.name}${pathParamsPath}`;

    const write = (writer: CodeBlockWriter) =>
        writer.write(`${endpoint.name}:`).block(() => {
            writer.write(`description: "${endpoint.description}",`).newLine()
                .write(`path: "${path}",`).newLine()
                .write(`verb: HTTPVerb.${endpoint.method},`).newLine()
                .write("validationRules: [],").newLine()
                .write("successStatus: HTTPStatusCode.OK").newLine()
        });

    const resourcePath = `../../binders-client-v1/src/clients/${getClientPath(endpoint.service)}/routes.ts`;
    const sourceFile = morphProject.addSourceFileAtPath(resourcePath);

    const routesGetterFunction = sourceFile.getFunction(f => f.isExported() && /.*Routes$/.test(f.getName()));
    const returnBlock = routesGetterFunction.getChildrenOfKind(SyntaxKind.Block)[0];
    const syntaxBlock = returnBlock.getChildrenOfKind(SyntaxKind.SyntaxList)[0];
    const returnStatement = syntaxBlock.getChildrenOfKind(SyntaxKind.ReturnStatement)[0];
    const objectLiteralExpression = returnStatement.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0];
    objectLiteralExpression.addProperty(write);

}

function insertInServiceRoutes(morphProject: Project, endpoint: Endpoint) {

    function getParamLoc(paramSource: ParamSource) {
        switch (paramSource) {
            case "path":
                return "params";
            default:
                return paramSource;
        }
    }

    const write = (writer: CodeBlockWriter) =>
        writer.write(`${endpoint.name}:`).block(() => {
            writer.write(`...appRoutes.${endpoint.name},`).newLine()
                .write("serviceMethod: withService(").newLine().indent(() => {
                    writer.write("(service, request) =>").block(() => {
                        for (const param of endpoint.params) {
                            writer.write(`const ${param.name} = request.${getParamLoc(param.source)}.${param.name};`).newLine();
                        }
                        writer.write(`return service.${endpoint.name}(${endpoint.params.map(p => p.name).join(", ")});`).newLine()
                    })
                }).write("),")
        });

    const resourcePath = `../../${getServiceBasepath(endpoint.service)}/routes.ts`;

    const sourceFile = morphProject.addSourceFileAtPath(resourcePath);

    const routesGetterFunction = sourceFile.getFunction(f => f.isExported() && /.*Routes$/.test(f.getName()));
    const returnBlock = routesGetterFunction.getChildrenOfKind(SyntaxKind.Block)[0];
    const syntaxBlock = returnBlock.getChildrenOfKind(SyntaxKind.SyntaxList)[0];
    const returnStatement = syntaxBlock.getChildrenOfKind(SyntaxKind.ReturnStatement)[0];
    const objectLiteralExpression = returnStatement.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0];
    objectLiteralExpression.addProperty(write);
}

function insertInService(morphProject: Project, endpoint: Endpoint, paramsString: string, returnType: string) {
    const write = (writer: CodeBlockWriter) =>
        writer.write(`${endpoint.name}(${paramsString}): ${returnType}`).block(() => {
            writer.write("throw new Error(\"Method not implemented.\");")
        });
    const resourcePath = `../../${getServiceBasepath(endpoint.service)}/service.ts`;
    const sourceFile = morphProject.addSourceFileAtPath(resourcePath);
    const serviceClass = sourceFile.getClass(c =>
        serviceClassRegexFromService(endpoint.service).test(c.getName()) &&
        c.isExported()
    );
    serviceClass.addMember(write);
}
