import { getReaderDomain } from "../../../../util";
import { startImpersonation } from "@binders/client/lib/util/impersonation";
import { useActiveAccountId } from "../../../../stores/hooks/account-hooks";
import { useCurrentUser } from "../../../../stores/hooks/user-hooks";

export const useStartImpersonation = (): (userId: string, password?: string) => unknown => {
    const me = useCurrentUser();
    const activeAccountId = useActiveAccountId();

    return async (deviceTargetUserId: string, password?: string) => {
        await startImpersonation(
            activeAccountId,
            deviceTargetUserId,
            me.id,
            {
                isDeviceUserTarget: true,
                redirectRoute: `/?domain=${getReaderDomain()}`,
                password
            }
        );
    }
}
