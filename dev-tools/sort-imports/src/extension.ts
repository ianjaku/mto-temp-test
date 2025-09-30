// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { splitFile } from './tsFile';
import { ImportSortOrder, IPrintOptions, printImportNodes, sortImports, splitImports } from './tsImports';

interface IExtensionOptions {
	printOptions: IPrintOptions;
	sortOrder: ImportSortOrder;
}

function getOptions(): IExtensionOptions {
	const config = vscode.workspace.getConfiguration("sortImports");
	return {
		printOptions: {
			multiLineEnabled: config.get<boolean>("multilineImports.enabled") || true,
			maxCharsPerLine: config.get<number>("multilineImports.maxCharsPerLine") || 100,
			quoteSymbol: config.get<string>("multilineImports.quoteSymbol") || "\"",
			fixSrcImports: config.get<boolean>("multilineImports.fixSrcImports") ?? true,
		},
		sortOrder: config.get<ImportSortOrder>("sortOrder") || ["all", "multiple", "single", "none"]
	};
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "sort-imports" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('sort-imports.sort-imports', () => {
		const editor = vscode.window.activeTextEditor;

		const config = vscode.workspace.getConfiguration("sortImports");
		if (editor) {
			const document = editor.document;
			const fullFile = document.getText();
			const { commentHeaders, rest, lineCount } = splitFile(fullFile);
			const top = commentHeaders.length > 0 ? `${commentHeaders}\n`: "";
			const { imports, srcFile, lastImportPosition } = splitImports(rest);
			const { printOptions, sortOrder } = getOptions();
			sortImports(imports, sortOrder);
			const output = `${top}${printImportNodes(imports, srcFile, printOptions)}${rest.substr(lastImportPosition)}`;
			editor.edit(editBuilder => {
				editBuilder.replace(new vscode.Range(0, 0, lineCount, 0), output);
			});
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
