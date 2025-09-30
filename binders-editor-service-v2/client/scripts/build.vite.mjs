import { access, readFile, writeFile } from "fs/promises";
import { build } from "vite";
import { constants } from "fs";

// eslint-disable-next-line no-console
const log = console.log
// eslint-disable-next-line no-console
const fail = console.error

async function doIt() {
    log("===> Compiling production build using vite");
    await build({
        configFile: "./vite.config.mts",
    });
    log("===> Vite production build successful");
    await buildIndexHtml({
        sourceIndexHtmlPath: "./vite/index.html",
        viteBuildIndexHtmlPath: "../service/dist/www/index.html",
        destIndexHtmlPath: "../service/dist/www/index.html",
    });
}

/**
 * Replaces the development script tag in the source HTML with the Vite build tags
 * and writes the resulting HTML to the destination file.
 *
 * @param {Object} options - Options for building the index HTML.
 * @param {string} options.sourceIndexHtmlPath - The file path of the source index HTML.
 * @param {string} options.viteBuildIndexHtmlPath - The file path of the Vite build index HTML.
 * @param {string} options.destIndexHtmlPath - The file path where the output index HTML will be written.
 * @returns {Promise<void>} A promise that resolves when the HTML has been built and written.
 */
async function buildIndexHtml(options) {
    if (!await fileExists(options.sourceIndexHtmlPath)) {
        throw new Error(`Source index HTML file not found at ${options.sourceIndexHtmlPath}`);
    }
    if (!await fileExists(options.viteBuildIndexHtmlPath)) {
        throw new Error(`Vite build index HTML file not found at ${options.viteBuildIndexHtmlPath}`);
    }

    const sourceContents = await readFile(options.sourceIndexHtmlPath, "utf-8");
    const viteBuildContents = await readFile(options.viteBuildIndexHtmlPath, "utf-8");

    const scriptRegex = /<script\s+type="module"\s+crossorigin\s+src="\/assets\/index-[^"]+\.js"><\/script>/;
    const scriptMatch = viteBuildContents.match(scriptRegex);
    if (!scriptMatch) {
        throw new Error("Could not find the expected script tag in the build index HTML file.");
    }
    const scriptTag = scriptMatch[0];

    log(` ->  Found scriptTag\n${scriptTag}`)

    const linkRegex = /<link\s+rel="stylesheet"\s+crossorigin\s+href="\/assets\/index-[^"]+\.css">/;
    const linkMatch = viteBuildContents.match(linkRegex);
    if (!linkMatch) {
        throw new Error("Could not find the expected link tag in the build index HTML file.");
    }
    const linkTag = linkMatch[0];
    log(` ->  Found linkTag\n${scriptTag}`)

    const viteHeadTags = `${scriptTag}\n\t${linkTag}`;

    const destContents = sourceContents.replace(
        /<script\s+type="module"\s+src="..\/src\/index.jsx"><\/script>/,
        viteHeadTags
    );

    await writeFile(options.destIndexHtmlPath, destContents, "utf-8");
    log(` ->  Successfully written ${options.destIndexHtmlPath}`);
}

async function fileExists(path) {
    try {
        await access(path, constants.F_OK);
        return true
    } catch {
        return false
    }
}

doIt().catch(fail)
