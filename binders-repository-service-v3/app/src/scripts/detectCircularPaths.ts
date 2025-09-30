/* eslint-disable no-console */
import { BackendRepoServiceClient } from "@binders/binders-service-common/lib/apiclient/backendclient";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";

const config = BindersConfig.get();

const getOptions = () => {
    if (process.argv.length !== 3) {
        console.error(`Usage: node ${__filename} <ITEM_ID>`);
        process.exit(1);
    }
    return {
        itemId: process.argv[2]
    };
};

const composePaths = async (itemId) => {
    const repoServiceClient = await BackendRepoServiceClient.fromConfig(config, "binders");
    const ancestors = await repoServiceClient.getAncestors(itemId);
    let paths;
    try {
        paths = detectCircularPaths(
            [
                {
                    pathArray: [ itemId],
                    finished: false
                }
            ],
            ancestors);
    }
    catch(err) {
        console.log(err.message);
    }
    console.log("no circular paths detected, paths:", paths);
}

const detectDoubles = (pathArrays: string[][]) => {
    let index = -1;
    pathArrays.forEach((pathArray, i) => {
        if(!pathArray.every(part => pathArray.filter(p => p === part).length === 1)) {
            index = i;
            return;
        }
    });
    return index;
}

const detectCircularPaths = (paths, ancestors) => {
    const unfinishedPaths = paths.filter(p => !p.finished);
    if(unfinishedPaths.length === 0) {
        return paths;
    }
    unfinishedPaths.forEach(path => {
        const itemId = path.pathArray[path.pathArray.length - 1];
        const parents = ancestors[itemId];
        switch(parents.length) {
            case 0:
                path.finished = true;
                break;
            case 1:
                path.pathArray.push(parents[0]);
                break;
            default:
                paths = paths.filter(p => p.pathArray !== path.pathArray);
                parents.forEach(parent => {
                    paths.push({
                        pathArray: path.pathArray.concat(parent),
                        finished: false
                    })
                });
                // eslint-disable-next-line no-case-declarations
                const indexOfPathWithDoubles = detectDoubles(paths.map(p => p.pathArray));
                if(indexOfPathWithDoubles !== -1) {
                    throw new Error("CIRCULAR PATH DETECTED" + paths[indexOfPathWithDoubles].pathArray.reverse().join("/"));
                }
        }
    });
    return detectCircularPaths(paths, ancestors);
}

composePaths(getOptions().itemId);
