const esbuild = require("esbuild");

async function doIt() {
    await esbuild.build({
        bundle: false,
        minify: false,
        color: true,
        logLevel: "info",
        entryPoints: ["src/**/*.ts"],
        outdir: "./dist/src",
        platform: "node",
        format: "cjs",
        sourcemap: "inline",
    });
}

// eslint-disable-next-line no-console
doIt().catch(console.error);
