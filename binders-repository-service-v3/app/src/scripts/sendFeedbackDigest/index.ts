/**
* This script sends a digest of all feedback (comments and feedbacks) on items to the item's owner(s), based on given period
*
* Usage:
*      yarn workspace @binders/binders-v3 node dist/src/scripts/sendFeedbackDigest/index.js [digestPeriodDaysAgo]
*
*/
/* eslint-disable no-console */
import * as path from "path";
import { sendFeedbackDigest } from "./sendFeedbackDigest";

const getOptions = () => {
    if (process.argv.length < 3 || isNaN(parseInt(process.argv[2]))) {
        console.error("Usage: node dist/src/scripts/sendFeedbackDigest.js <digestPeriodDaysAgo(int)>");
        process.exit(1);
    }
    return {
        digestPeriodDaysAgo: parseInt(process.argv[2]),
        dryRun: process.argv[3] === "--dry-run",
    };
};


const doIt = async () => {
    global["commonStaticRoot"] = path.join(path.resolve(__dirname), "../../../../../../binders-service-common-v1/assets");
    const { digestPeriodDaysAgo, dryRun } = getOptions();
    await sendFeedbackDigest(digestPeriodDaysAgo, dryRun);
};

doIt()
    .then(() => {
        console.log("Finished \\ (•◡•) /")
        process.exit(0);
    }, error => {
        console.error(error)
        process.exit(1)
    });
