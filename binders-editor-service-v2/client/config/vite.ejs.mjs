import ejs from "ejs";

/**
 * Replaces ejs variables with given values.
 *
 * @param {Record<string, any>} vars - Values to replace
 */
export function viteEjs(vars) {
    let config;
    return {
        name: "vite-plugin-ejs",
        configResolved(resolvedConfig) { config = resolvedConfig; },
        transformIndexHtml: {
            order: "pre",
            handler(html) {
                return ejs.render(html, vars, { views: [config.root], async: false });
            },
        },
    };
}

