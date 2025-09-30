import {buildAcl1, setup} from "./setup";

import {PermissionName} from "@binders/client/lib/clients/authorizationservice/v1/contract";

describe("ACL Repo CRUD", () => {
    test("it should CRUD acls correctly", () => {
        return setup()
            .then( env => {
                const repo = env.repo;
                const acl = buildAcl1();
                return repo.createAcl(acl)
                    .then( () => repo.getAcl(acl.id) )
                    .then( retrievedAcl => expect(JSON.stringify(retrievedAcl)).toEqual(JSON.stringify(acl)))
                    .then( () => {
                        acl.rules[0].permissions.push({name: PermissionName.CREATE});
                        return repo.updateAcl(acl, acl.id);
                    })
                    .then( updatedAcl => {
                        expect(JSON.stringify(updatedAcl)).toEqual(JSON.stringify(acl));
                        return repo.getAcl(acl.id);
                    })
                    .then( retrievedAcl => {
                        expect(JSON.stringify(retrievedAcl)).toEqual(JSON.stringify(acl));
                        return repo.deleteAcl(acl.id);
                    })
                    .then( () => {
                        return repo.getAcl(acl.id)
                            .then(() => expect("Retrieved a").toEqual("deleted acl"))
                            .catch(error => expect(error.message).toContain("Could not find"));
                    })
                    .then( () => env.cleanup() )
                    .catch(error => {
                        return env.cleanup().then( () => { throw error; } );
                    });
            });
    });
});

