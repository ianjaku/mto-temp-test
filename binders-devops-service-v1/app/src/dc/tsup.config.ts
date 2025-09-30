import { defineConfig } from "tsup";

export default defineConfig({
    entry: [
        "src/dc/main.ts",
    ],
    outDir: "dist/src/dc",
    splitting: false,
    sourcemap: false,
    clean: true,
    format: ["cjs"],
    noExternal: [/(.*)/],
});
