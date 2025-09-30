import * as ts from "typescript";

const FAKE_FILE_NAME = "sort-import.ts";

export type ImportKind = "none" | "all" | "multiple" | "single" ;
export type ImportSortOrder = [ImportKind, ImportKind, ImportKind, ImportKind];

const defaultSortOrder: ImportSortOrder = ["all", "multiple", "single", "none"];

export interface IASTNodesGroupedIfImport {
    srcFile: ts.SourceFile,
    imports: ts.Node[];
    rest: ts.Node[];
    lastImportPosition: number;
}

export function splitImports(sourceText: string): IASTNodesGroupedIfImport {
    const srcFile = ts.createSourceFile(FAKE_FILE_NAME, sourceText, ts.ScriptTarget.Latest);
    const imports: ts.Node[] = [];
    const rest: ts.Node[] = [];
    let lastImportPosition = 0;
    ts.forEachChild(srcFile, (node: ts.Node) => {
        if (node.kind === ts.SyntaxKind.ImportDeclaration) {
            imports.push(node);
            lastImportPosition = node.end;
        } else {
            rest.push(node);
        }
    });
    return {
        srcFile,
        imports,
        rest,
        lastImportPosition
    };
}

function getImportKind (node: ts.Node): ImportKind {
    const { importClause } = (node as any);
    if (!importClause) {
        return "none";
    }
    const { name, namedBindings } = importClause;
    if ( namedBindings?.name ) {
        return "all";
    }
    const defaultImportCount = name ? 1 : 0;
    const namedImportCount = (namedBindings?.elements || []).length;
    return (defaultImportCount + namedImportCount) > 1 ? "multiple" : "single";
}

function getImportedFirstName (node: ts.Node): string {
    const { importClause, moduleSpecifier } = (node as any);
    if (!importClause) {
        return moduleSpecifier?.text; // File name (no importClause)
    }
    const { name, namedBindings } = importClause;
    if ( namedBindings?.name ) {
        return importClause.namedBindings?.name?.escapedText; // Module name for an 'all' import
    }
    if ( name ) {
        return name?.escapedText; // Default import
    }
    return namedBindings?.elements[0]?.name?.escapedText; // Take the first of the named imports

}

export function sortImports(importNodes: ts.Node[], sortOrder = defaultSortOrder) {
    const cmp = (left: ts.Node, right: ts.Node) => {
        const leftKind = getImportKind(left);
        const rightKind = getImportKind(right);
        if (leftKind !== rightKind) {
            const leftWeight = sortOrder.indexOf(leftKind);
            const rightWeight = sortOrder.indexOf(rightKind);
            return leftWeight - rightWeight;
        }
        const leftFirst = getImportedFirstName(left);
        const rightFirst = getImportedFirstName(right);
        return leftFirst === rightFirst ? 0 : (leftFirst < rightFirst ? -1 : 1);
    };
    importNodes.sort(cmp);
}

export interface IPrintOptions {
    multiLineEnabled: boolean;
    quoteSymbol: string;
    maxCharsPerLine: number;
    fixSrcImports: boolean;
}

function printNamedBindingElement(namedBinding: any) {
    const { name, propertyName } = namedBinding;
    if (propertyName) {
        return `${propertyName.escapedText} as ${name.escapedText}`;
    } else {
        return name.escapedText;
    }
}

function printMultiLineImportNode(node: ts.Node, printOptions: IPrintOptions): string | undefined {
    const { importClause, moduleSpecifier } = (node as any);
    if (!importClause) {
        return undefined; // There is no clause, meaning import of file like stylus
    }
    const { name, namedBindings } = importClause;
    if ( namedBindings?.name ) {
        return undefined; // Module name for an 'all' import
    }
    if ( (namedBindings?.elements || []).length === 0 ) {
        return undefined; // No named bindings to multi-line
    }

    const defaultImport = name ? `${name.escapedText}, ` : "";
    const namedImports = namedBindings.elements
        .map(printNamedBindingElement)
        .join(",\n    ");
    const imports = `${defaultImport}{\n    ${namedImports}\n}`;
    const moduleName = printOptions.fixSrcImports ? fixBindersSrcModuleName(moduleSpecifier.text) : moduleSpecifier.text;
    const quote = printOptions.quoteSymbol;
    return `import ${imports} from ${quote}${moduleName}${quote};`;
}

function printImportNode(node: ts.Node, printer: ts.Printer, srcFile: ts.SourceFile, printOptions: IPrintOptions): string {
    const printed = printer.printNode(ts.EmitHint.Unspecified, node, srcFile);
    const oneLineImport = printOptions.fixSrcImports ? fixBindersSrcModuleName(printed) : printed;
    const { maxCharsPerLine } = printOptions;
    if (oneLineImport.length < maxCharsPerLine || !printOptions.multiLineEnabled) {
        return oneLineImport;
    }
    return printMultiLineImportNode(node, printOptions) || oneLineImport;
}

/**
 * Changes <code>from "@binders/client/src/file"</code> to <code>from "@binders/client/lib/file"</code>
 */
function fixBindersSrcModuleName(moduleName: string): string {
    const regex = /^(.*?@binders\/[^\/]+)\/src\/(.*)$/;
    const match = moduleName.match(regex);
    if (!match) {
        return moduleName;
    }
    return `${match[1]}/lib/${match[2]}`;
}

export function printImportNodes(nodes: ts.Node[], srcFile: ts.SourceFile, printOptions: IPrintOptions): string {
    const printer =  ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return nodes
        .map(node => printImportNode(node, printer, srcFile, printOptions))
        .join("\n");
}
