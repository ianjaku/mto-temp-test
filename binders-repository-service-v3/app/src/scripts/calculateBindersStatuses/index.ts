import { calculateBindersStatuses } from "./calculateBindersStatuses";

(async function run() {
    await calculateBindersStatuses();
    process.exit(0);
})()