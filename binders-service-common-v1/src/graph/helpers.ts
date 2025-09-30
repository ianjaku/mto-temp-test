/**
 * Built for endpoint format <code>.../users/<userId>/</code><br>
 * (e.g. on {@link graph.windows.net} or {@link graph.microsoft.com})
*/
export function parseUserIdFromGroupsLink(link: string): string {
    // find part that comes after /users/
    const parts = link.split("/users/");
    if (parts.length !== 2) {
        throw new Error(`Error parsing userId from graphAPI url; Unexpected format ${link}`);
    }
    return parts[1].split("/")[0];
}
