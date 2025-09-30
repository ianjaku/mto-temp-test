export type SearchUsersOrGroupsHit = {
    label: string;
    rawLabel: string;
    value: string;
    id: string;
}

export interface SearchUsersOrGroupsResult {
    hits: SearchUsersOrGroupsHit[],
    totalHits: number
}

