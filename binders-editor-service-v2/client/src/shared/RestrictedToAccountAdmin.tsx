import * as React from "react";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import AccountStore from "../accounts/store";
import FallbackComponent from "../application/FallbackComponent";
import { useFluxStoreAsAny } from "@binders/client/lib/react/helpers/hooks";

const RestrictedToAccountAdmin: React.FC = ({ children }) => {
    const activeAccount: Account = useFluxStoreAsAny(AccountStore, (_prevState, store) => store.getActiveAccount());
    return activeAccount.amIAdmin ?
        <>{children}</> :
        <FallbackComponent notFound={true} />
}

export default RestrictedToAccountAdmin