import { User } from "@binders/client/lib/clients/userservice/v1/contract";

/**
 * Heuristically determine the first and last name of a user based on the available fields.
 */
export const getUserFirstAndLastName = (user: Partial<User>): [string, string] => {
    if (user.firstName && user.lastName) {
        return [user.firstName, user.lastName];
    }
    const displayName = user.displayName?.trim();
    if (displayName) {
        // If display name is provided, use it
        if (displayName.includes(" ")) {
            // If there is a space in the string use the last word as the last name, and the remainder as the first name
            const firstName = displayName.split(" ").shift();
            const lastName = displayName.split(" ").slice(1).join(" ");
            return [firstName, lastName];
        }
        // otherwise, just use the display name as the last name and blank as the first name
        return ["", displayName];
    }
    // Otherwise, return one or the other
    return [user.firstName, user.lastName];
}
