/* eslint-disable no-console */
import * as fs from "fs";
import en from "@binders/client/lib/i18n/translations/en_US";
import fr from "@binders/client/lib/i18n/translations/fr";
import nl from "@binders/client/lib/i18n/translations/nl";

function normalizeValue(value: string): string {
    return value
        .replace(/"/g, "'")
        .replace(/\s+/gs, " ")
        .replace(/Ω/g, "")
        .replace(/;/g, ",");
}

(async function doIt() {
    Object.keys(nl).forEach(key => {
        nl[key] = normalizeValue(nl[key]);
    });
    Object.keys(fr).forEach(key => {
        fr[key] = normalizeValue(fr[key]);
    });
    Object.keys(en).forEach(key => {
        en[key] = normalizeValue(en[key]);
    });
    const csv = Object.keys(nl).reduce((acc, key) => {
        return `${acc}\n${key};${nl[key]};${en[key]};${fr[key]}`;
    }, "key;nl;en;fr");
    const outputFile = "/tmp/i18n.csv";
    fs.writeFileSync(outputFile, csv);
    console.log(`All done! Written to ${outputFile}`);
})();
