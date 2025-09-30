/* eslint-disable no-console */
import fs from "fs";
import parse from "csv-parse/lib/es5";

/**
 * Starting from an account analytics export csv file that contains "Read Document" and "Created Item" actions,
 * this script aggregates the number of reads and creations over time,
 * as well as a top 50 list of most read documents
 *
 * To be ran in a dev environment (csv-parse is a dev dependency)
 *
 * It assumes a correct csv in the following format:
 * user,login,groups,action,item,url,docId,time,duration,cdsid
 * and does not handle any errors
 */

const filePath = "/tmp/input.csv";

interface MonthlyCount {
    [month: string]: number;
}

interface DocumentReadCount {
    [docId: string]: number;
}

const monthlyReads: MonthlyCount = {};
const monthlyCreations: MonthlyCount = {};
const documentReads: DocumentReadCount = {};

const parseDateToMonth = (dateString: string): string => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
};

async function parseCsv(csvFilepath: string): Promise<Array<string[]>> {
    const output = [];
    const parser = parse({
        delimiter: ",",
        // eslint-disable-next-line quotes
        quote: '"',
        relax_column_count: true,
        skip_empty_lines: true,
        trim: true
    });
    let headerRead = false;

    return new Promise((resolve, reject) => {
        parser.on("readable", function () {
            let record;
            // eslint-disable-next-line
            while ((record = parser.read())) {
                if (!headerRead) {
                    headerRead = true;
                    continue;
                }
                if (record && record.join() !== "") {
                    output.push(record);
                }
            }
        });
        parser.on("error", function (err) {
            reject(err);
        });
        parser.on("finish", function () {
            resolve(output);
        });
        const csvFileRaw = fs.readFileSync(csvFilepath, "utf-8");
        const properLineEndingsCsv = csvFileRaw.replace(/\r?\n|\r/g, "\n");
        parser.write(properLineEndingsCsv);
        parser.end();
    });
}

(async () => {
    try {
        const csvRecords = await parseCsv(filePath);
        const invalidDates: string[] = [];
        let invalidDateCount = 0;

        csvRecords.forEach((row, index) => {
            // Debug: log first few rows to check column alignment
            if (index < 3) {
                console.log(`\nDebug Row ${index + 2}:`);
                console.log(`  Columns: ${row.length}`);
                row.forEach((col, i) => console.log(`    [${i}]: "${col}"`));
            }

            const [_user, _login, _groups, action, item, _url, docId, time, _duration, _cdsid] = row;

            // Debug invalid dates
            if (action === "Read Document" || action === "Created Item") {
                const parsedDate = new Date(time);
                if (isNaN(parsedDate.getTime())) {
                    invalidDateCount++;
                    if (invalidDates.length < 10) {  // Collect first 10 examples
                        invalidDates.push(`Row ${index + 2}: time="${time}", action="${action}"`);
                    }
                }
            }

            if (action === "Read Document") {
                const month = parseDateToMonth(time);

                // Aggregate Monthly Reads
                if (!monthlyReads[month]) {
                    monthlyReads[month] = 0;
                }
                monthlyReads[month]++;

                // Aggregate Document Reads
                const key = `${item} (${docId})`;
                if (!documentReads[key]) {
                    documentReads[key] = 0;
                }
                documentReads[key]++;
            }
            if (action === "Created Item") {
                const month = parseDateToMonth(time);

                // Aggregate Monthly Creations
                if (!monthlyCreations[month]) {
                    monthlyCreations[month] = 0;
                }
                monthlyCreations[month]++;
            }
        });

        // Debug output for invalid dates
        if (invalidDateCount > 0) {
            console.log("\n=== DEBUG: Invalid Date Analysis ===");
            console.log(`Total rows with invalid dates: ${invalidDateCount}`);
            console.log("Sample invalid date entries:");
            invalidDates.forEach(entry => console.log(`  ${entry}`));
            console.log("===================================\n");
        }

        // Calculate totals
        const totalReads = Object.values(monthlyReads).reduce((sum, count) => sum + count, 0);
        const totalCreations = Object.values(monthlyCreations).reduce((sum, count) => sum + count, 0);

        console.log("Monthly Read Aggregation:", monthlyReads);
        console.log("Total Reads:", totalReads);
        console.log("Monthly Creation Aggregation:", monthlyCreations);
        console.log("Total Creations:", totalCreations);

        // Generate Top 50 Most Read Documents
        const topDocuments = Object.entries(documentReads)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50)
            .map(([doc, count], index) => ({
                rank: index + 1,
                document: doc,
                reads: count
            }));

        console.log("Top 50 Most Read Documents:", topDocuments);
    } catch (error) {
        console.error("Error in script:", error);
    }
})();