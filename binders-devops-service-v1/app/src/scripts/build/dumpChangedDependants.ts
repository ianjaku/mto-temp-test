/* eslint-disable no-console */
import { getChangedDependants } from "../../actions/build/deps";
import { main } from "../../lib/program";


main(async () => {
    const changedDeps = await getChangedDependants([
        "/home/tom/Projects/binders-service/binders-user-service-v1/app/src/userservice/routes.ts"
    ]);
    console.log(changedDeps);
});
