import { User } from "@binders/client/lib/clients/userservice/v1/contract";

export function getCevaTagValue(user: User, tagValue: string): string {
    if (!user.userTags) return "";
    const dptTag = user.userTags.find(ut => ut.context === "ceva" && ut.name === tagValue);
    if (!dptTag) return "";
    return dptTag.value;
}
