/* eslint-disable no-console */
import { deleteTestAccounts } from "@binders/binders-service-common/lib/testutils/cleanup";
import { isProduction } from "@binders/client/lib/util/environment";

const removeTestAccounts = async () => {
    if (isProduction()) {
        console.log("Skipping since we are on production.");
        return;
    }
    await deleteTestAccounts();
}

removeTestAccounts()
    .then(() => console.log("Finished"))
    .catch(e => console.log("Error:", e));
