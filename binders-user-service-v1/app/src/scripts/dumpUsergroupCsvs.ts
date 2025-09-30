/* eslint-disable no-console */
import { BackendUserServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient"
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders"
import { writeFileSync } from "fs"

const getOptions = () => {
    const accountId = process.argv[2];
    if (!accountId) {
        console.error("Please provide an accountId.");
        process.exit(1);
    }
    return {
        accountId
    }
}

const getDeps = async () => {
    const config = BindersConfig.get();
    const userServiceClient = await BackendUserServiceClient.fromConfig(config, "export-usergroups-to-csv");
    return {
        userServiceClient,
    };
}

async function writeCsv(values: string[][], headers: string[], name: string) {
    const csvWithHeaders = [
        headers.join(","),
        ...values
    ]
    const stringContent = csvWithHeaders.join("\n");
    writeFileSync(`/tmp/${name}.csv`, stringContent);
}
(async function () {
    const { accountId } = getOptions();
    const { userServiceClient } = await getDeps();

    const groups = await userServiceClient.getGroups(accountId);
    const groupDetails = await userServiceClient.multiGetGroupMembers(accountId, groups.map(g => g.id));

    const { csv1Values, csv2Values } = groupDetails.reduce((reduced, groupDetail) => {
        const { csv1Values, csv2Values } = reduced;
        const { group: { name }, memberCount, members } = groupDetail;
        csv1Values.push([name, memberCount]);
        csv2Values.push(...members.map(member => [name, member.login]));
        return {
            csv1Values,
            csv2Values,
        }
    }, { csv1Values: [], csv2Values: [] });

    await writeCsv(
        csv1Values,
        ["group name", "member count"],
        "groupMemberCount"
    );
    await writeCsv(
        csv2Values,
        ["group name", "user login"],
        "groupMemberships"
    )
})();

/*
groepName, memberCount
groepName, userLogin
*/