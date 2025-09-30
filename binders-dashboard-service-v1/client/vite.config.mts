import * as path from "path";
import commonjs from "vite-plugin-commonjs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vitejs.dev/config/
export default defineConfig({
    publicDir: "../public",
    root: "./vite",
    plugins: [
        commonjs(),
        react(),
        tsconfigPaths(),
    ],
    css: {
        preprocessorOptions: {
            stylus: {
                imports: [path.resolve(__dirname, "../../binders-ui-kit/src/vars.styl")],
                additionalData: `@import "${path.resolve(
                    __dirname,
                    "../../binders-ui-kit/src/vars.styl"
                )}"`,
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
