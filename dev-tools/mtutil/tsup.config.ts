import { defineConfig } from "tsup";

export default defineConfig({
    entry: [
        "src/cli.ts",
        "src/mtutil.ts",
    ],
    splitting: false,
    sourcemap: false,
    clean: true,
    format: ["cjs"],
    noExternal: [ /(.*)/ ],
});
