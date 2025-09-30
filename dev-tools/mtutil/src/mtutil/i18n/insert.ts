import { Project, ScriptTarget, SyntaxKind } from "ts-morph";
import { Translation } from "./prompt";

function getResourceFilename(langCode: string): string {
    return {
        "en": "en_US",
    }[langCode] || langCode;
}

async function addTranslation(
    identifier: string,
    translation: Translation,
    resourcePath: string,
): Promise<void> {
    const morphProject = new Project({
        compilerOptions: {
            target: ScriptTarget.ES2020,
        },
    });

    const translations = morphProject.addSourceFileAtPath(resourcePath)
        .getVariableDeclaration("translation")
        .getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0];

    translations.addProperty(`${identifier}: \`${translation.text}${translation.isConfident ? "" : "__"}\`,`);

    const properties = translations.getProperties();
    const sortedProperties = properties.sort((a, b) => {
        const keyA = a.getText().split(":").at(0);
        const keyB = b.getText().split(":").at(0);
        if (keyA === keyB) return 0;
        return keyA < keyB ? -1 : 1;
    });

    translations.replaceWithText(writer => {
        writer.write("{").newLine();
        sortedProperties.forEach(property => {
            writer.write("    ");
            writer.write(property.getText());
            writer.write(",").newLine();
        });
        writer.write("}");
    });

    await morphProject.save();
    console.log(`Updated ${resourcePath}`);
}

export async function insertI18nString(
    identifier: string,
    translations: Record<string, Translation>,
): Promise<void> {
    for (const [langCode, translation] of Object.entries(translations)) {
        const resourceFilename = getResourceFilename(langCode);
        const resourcePath = `../../binders-client-v1/src/i18n/translations/${resourceFilename}.ts`;
        addTranslation(identifier, translation, resourcePath);
    }

}
