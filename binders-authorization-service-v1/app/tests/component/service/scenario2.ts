import {
    AssigneeType,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { EntityMapperFactory, InMemoryEntityMapper } from "../../../src/authorization/entitymapper";
import { constants, setup } from "./setup";

/* 
    Account 1 contains User 1
    Account 1 contains User 2
    Account 2 contains User 3
    Document 1 belongs to Account 1
    Document 2 belongs to Account 1
    Document 3 belongs to Account 2
*/

class FakeEntityMapper extends InMemoryEntityMapper {
    constructor() {
        super();
        this.addUser(constants.USER_1, constants.ACCOUNT_1);
        this.addUser(constants.USER_2, constants.ACCOUNT_1);
        this.addUser(constants.USER_3, constants.ACCOUNT_2);
        this.addDocument(constants.DOCUMENT_1, constants.ACCOUNT_1);
        this.addDocument(constants.DOCUMENT_2, constants.ACCOUNT_1);
        this.addDocument(constants.DOCUMENT_3, constants.ACCOUNT_2);
    }
}

const mapperFactory: EntityMapperFactory = {
    forRequest: () => Promise.resolve(new FakeEntityMapper())
};

describe("authorization service scenario 2", () => {
    test("single user, only read access", () => {
        return setup(mapperFactory).then(testSetup => {
            const service = testSetup.service;
            function getPermissions(userId, documentId) {
                return service.findResourcePermissions(userId, ResourceType.DOCUMENT, documentId);
            }
            return Promise.all([
                service.createAcl(
                    "account1-readonly-docs",
                    "aid1-readonly docs",
                    constants.ACCOUNT_1,
                    [{ type: AssigneeType.ACCOUNT, ids: [constants.ACCOUNT_1] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: ["doc-1"]
                            },
                            permissions: [{ name: PermissionName.VIEW }]
                        }
                    ],
                    "rol-123"
                ),
                service.createAcl(
                    "document 2-public",
                    "doc2 = public",
                    constants.ACCOUNT_1,
                    [{ type: AssigneeType.PUBLIC, ids: [] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: [constants.DOCUMENT_2]
                            },
                            permissions: [{ name: PermissionName.VIEW }]
                        }
                    ],
                    "rol-123"
                )
            ])
                .then(() => getPermissions(constants.USER_1, constants.DOCUMENT_1))
                .then(permissions => expect(permissions).toHaveLength(1))
                .then(() => getPermissions(constants.USER_3, constants.DOCUMENT_1))
                .then(permissions => expect(permissions).toHaveLength(0))
                .then(() => getPermissions(constants.USER_2, constants.DOCUMENT_2))
                .then(permissions => expect(permissions).toHaveLength(1))
                .then(() => getPermissions(constants.USER_3, constants.DOCUMENT_2))
                .then(permissions => expect(permissions).toHaveLength(1))
                .then(() => getPermissions(constants.USER_1, constants.DOCUMENT_3))
                .then(permissions => expect(permissions).toHaveLength(0))
                .then(() => getPermissions(constants.USER_2, constants.DOCUMENT_3))
                .then(permissions => expect(permissions).toHaveLength(0))
                .then(() => getPermissions(constants.USER_3, constants.DOCUMENT_3))
                .then(permissions => expect(permissions).toHaveLength(0))
                .then(() => testSetup.cleanup())
                .catch(error => {
                    testSetup.cleanup();
                    throw error;
                });
        });
    });
});
