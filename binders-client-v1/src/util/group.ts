export const isNotDefaultAccountGroupName = (name: string): boolean =>
    name !== "All users" && name !== "Account admins";
