const esbuild = require("esbuild");

async function doIt() {
    await esbuild.build({
        bundle: false,
        minify: false,
        color: true,
        logLevel: "info",
        entryPoints: ["src/dc/scripts/*.ts"],
        outdir: "./dist/dc",
        platform: "node",
        format: "cjs",
    });
}

// eslint-disable-next-line no-console
doIt().catch(console.error);
