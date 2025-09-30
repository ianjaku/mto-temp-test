import {
    AssigneeType,
    PermissionName,
    ResourceType
} from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { EntityMapperFactory, InMemoryEntityMapper } from "../../../src/authorization/entitymapper";
import { constants, setup } from "./setup";

/*
    Account 1 contains User 1
    All users from account 1 should have VIEW permission on all documents of account 1
    User 1 should have EDIT permission on all documents of account 1
    Account 1 contains User 2
    Account 2 contains User 3
    Document 1 belongs to Account 1
    Document 2 belongs to Account 2


    TEST: user1 should have view and edit permission on document 1
    TEST: user2 should not have any permissions on document 1
    TEST: user1 should not have any permissions on document 2
    TEST: user2 should not have any permissions on document 2
*/

class FakeEntityMapper extends InMemoryEntityMapper {
    constructor() {
        super();
        this.addUser(constants.USER_1, constants.ACCOUNT_1);
        this.addUser(constants.USER_2, constants.ACCOUNT_1);
        this.addUser(constants.USER_3, constants.ACCOUNT_2);
        this.addDocument(constants.DOCUMENT_1, constants.ACCOUNT_1);
        this.addDocument(constants.DOCUMENT_2, constants.ACCOUNT_2);
    }
}

const mapperFactory: EntityMapperFactory = {
    forRequest: () => Promise.resolve(new FakeEntityMapper())
};

describe("authorization service scenario 1", () => {
    test("single user, only read access", () => {
        return Promise.all([setup(mapperFactory), mapperFactory.forRequest({})]).then(([testSetup, mapper]) => {
            const service = testSetup.service;
            const aid1 = constants.ACCOUNT_1;
            function getAcls(userId, documentId) {
                return Promise.all([
                    mapper.getAssignees(AssigneeType.USER, userId),
                    mapper.getResources(ResourceType.DOCUMENT, documentId)
                ]).then(([assignees, resources]) => service.findAclMatches(assignees, resources));
            }
            return Promise.all([
                service.createAcl(
                    "account1-readonly-docs",
                    "aid1-readonly docs",
                    aid1,
                    [{ type: AssigneeType.ACCOUNT, ids: [aid1] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: [aid1]
                            },
                            permissions: [{ name: PermissionName.VIEW }]
                        }
                    ],
                    "rol-123"
                ),
                service.createAcl(
                    "user1-edit-docs",
                    "user1-edit-docs desc",
                    aid1,
                    [{ type: AssigneeType.USER, ids: [constants.USER_1] }],
                    [
                        {
                            resource: {
                                type: ResourceType.DOCUMENT,
                                ids: [constants.DOCUMENT_1]
                            },
                            permissions: [{ name: PermissionName.EDIT }]
                        }
                    ],
                    "rol-123"
                )
            ])
                .then(() => getAcls(constants.USER_1, constants.DOCUMENT_1))
                .then(acls => expect(acls).toHaveLength(2))
                .then(() => getAcls(constants.USER_2, constants.DOCUMENT_1))
                .then(acls => expect(acls).toHaveLength(1))
                .then(() => getAcls(constants.USER_3, constants.DOCUMENT_1))
                .then(acls => expect(acls).toHaveLength(0))
                .then(() => getAcls(constants.USER_1, constants.DOCUMENT_2))
                .then(acls => expect(acls).toHaveLength(0))
                .then(() => getAcls(constants.USER_2, constants.DOCUMENT_2))
                .then(acls => expect(acls).toHaveLength(0))
                .then(() => getAcls(constants.USER_3, constants.DOCUMENT_2))
                .then(acls => expect(acls).toHaveLength(0))
                .then(() => testSetup.cleanup())
                .catch(error => {
                    testSetup.cleanup();
                    throw error;
                });
        });
    });
});
