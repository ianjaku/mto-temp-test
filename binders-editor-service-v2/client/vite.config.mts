import * as path from "path";
import commonjs from "vite-plugin-commonjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { viteEjs } from "./config/vite.ejs.mjs";
import { viteImportStylus } from "./config/vite.stylus.mjs";

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: "../public",
    root: "./vite",
    build: {
        ssrManifest: true,
        outDir: path.resolve(__dirname, "../service/dist/www"),
        emptyOutDir: true,
    },
    plugins: [
        viteEjs({
            faviconUrl: null,
            config: {},
            impersonation: null,
            buildInfo: null,
            disableLogRocket: true,
            launchDarklyFlags: null,
        }),
        viteImportStylus(),
        commonjs(),
        react(),
        tsconfigPaths(),
    ],
    optimizeDeps: {
        esbuildOptions: {
            define: {
                // needed for draftjs
                global: "globalThis",
            },
        },
    },
    resolve: {
        alias: {
            "@binders/client/assets": path.resolve(__dirname, "../../binders-client-v1/assets"),
            "@binders/client/lib": path.resolve(__dirname, "../../binders-client-v1/src"),
            "@binders/ui-kit/lib": path.resolve(__dirname, "../../binders-ui-kit/src"),
        },
    },
});
