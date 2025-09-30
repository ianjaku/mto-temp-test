import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";

const bindersMediaAccountNames = ["Binders Media", "demo.manual.to"];
export const isBindersMedia = (
    account: Account
): boolean => (
    bindersMediaAccountNames.some(
        (aName: string) => (
            aName.toLowerCase().trim() === (account.name || "").toLowerCase().trim()
        )
    )
)
