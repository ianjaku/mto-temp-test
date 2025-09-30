export const prefixGeneratedAssets = (html: string, pathPrefix: string): string => {
    return html
        .replace(/<link href="\/assets\//, `<link href="${pathPrefix}/assets/`)
        .replace(/<script (.*) src="\/assets\//, `<script $1 src="${pathPrefix}/assets/`);
}

