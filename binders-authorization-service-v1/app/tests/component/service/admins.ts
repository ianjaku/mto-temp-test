import {EntityMapperFactory, InMemoryEntityMapper} from "../../../src/authorization/entitymapper";
import {constants, setup} from "./setup";

const mapperFactory: EntityMapperFactory = {
    forRequest: () => Promise.resolve(new InMemoryEntityMapper())
};

describe("authorization service scenario 1", () => {
    test ("single user, only read access", () => {
        return setup(mapperFactory)
            .then( testSetup => {
                const service = testSetup.service;
                const aid1 = constants.ACCOUNT_1;
                const uid1 = constants.USER_1;
                const col1 = constants.COLLECTION_1;
                return service.createDefaultAccountRoles(aid1, col1)
                    .then(() => service.getAccountAdmins(aid1))
                    .then(admins => {
                        expect(admins).toHaveLength(0);
                        return service.addAccountAdmin(aid1, uid1);
                    })
                    .then(() => service.getAccountAdmins(aid1))
                    .then(admins => {
                        expect(admins).toHaveLength(1);
                        expect(admins[0]).toEqual(uid1);
                        return service.removeAccountAdmin(aid1, uid1);
                    })
                    .then(
                        () => expect("Cannot remove last admin").toBe(false),
                        error => {
                            expect(error.message).toContain("last account admin");
                        }
                    )
                    .then( () => testSetup.cleanup() )
                    .catch( error => {
                        testSetup.cleanup();
                        throw error;
                    });
            });
    });
});
