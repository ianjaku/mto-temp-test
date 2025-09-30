/* eslint-disable no-console */
import { exportRowsToSheetsFiles } from "../src/util/xlsx";

function getOptions() {
    if (process.argv.length < 3) {
        console.log(`Defaulting to en_US, node ${__filename} <lang ts file> to target another language`);
    }
    return {
        lang: process.argv[2] || "en_US",
    };
}
(async () => {
    const { lang } = getOptions();
    const { default: langObj } = await import(`../src/i18n/translations/${lang}`);
    const data = Object.keys(langObj).map(key => [key, langObj[key]]);
    const filename = `${lang}.xlsx`;
    exportRowsToSheetsFiles(
        data,
        `${lang} translations`,
        filename,
    );
    console.log(`File written to ${filename}`)
})();


