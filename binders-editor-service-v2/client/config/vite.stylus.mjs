import path from 'path'

const uiKitPath = path.resolve(path.join(__dirname + "../../../../binders-ui-kit"));

export function viteImportStylus() {
    return {
        name: 'vite-stylus-import-pluginx',
        enforce: "pre",
        async transform(code, id) {
            if (id.endsWith(".styl")) {
                return {
                    code: code.replaceAll("@require \"~@binders/ui-kit/lib", `@require "${uiKitPath}/src`),
                    map: null,
                }
            }
            return null
        }
    }
}
