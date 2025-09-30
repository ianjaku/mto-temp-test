/**
 * Adds sentToIds to all sentNotifications based on the existing sentToId field.
 * 
 * Usage:
 *      yarn workspace @binders/notification-v1 node dist/src/scripts/addSentToIdsToSentNotifications/index.js
 * 
 * Args: 
 *      None
 * 
 */
/* eslint-disable no-console */
import { addSentToIdsToSentNotifications } from "./addSentToIdsToSentNotifications";

addSentToIdsToSentNotifications()
    .then(() => console.log("I'm all done here. Thanks."))
    .catch(e => console.log("Error!", e));
