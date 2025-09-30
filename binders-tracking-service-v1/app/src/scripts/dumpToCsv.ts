/* eslint-disable no-console */
import { readFileSync, writeFileSync } from "fs";

// const userAction = "ITEM_CREATED";
const userAction = "DOCUMENT_READ";
const inFile = `/tmp/useractions/useractions-${userAction}-with-details.json`;
const outFile = `/tmp/useractions/useractions-${userAction}-with-details.csv`;

const doIt = async () => {
    const data = JSON.parse(readFileSync(inFile).toString());
    let csvContent = "type,account,title,login,name,date\n";
    for (const row of data) {
        const { itemKind, accountName, itemName, login, displayName, when } = row;
        const csvRow = `${itemKind === "binder" ? "document" : "collection"},${accountName},${itemName.replace(",", " ")},${login},${displayName},${when}\n`;
        csvContent += csvRow;
    }
    writeFileSync(outFile, csvContent);
}


doIt()
    .then(
        () => {
            console.log("! All done.");
            process.exit(0)
        },
        err => {
            console.log(err);
            process.exit(1);
        }
    )