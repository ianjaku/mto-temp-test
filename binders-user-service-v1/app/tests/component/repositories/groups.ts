import * as mongoose from "mongoose";
import {
    IUsergroup,
    MongoUsergroupRepository,
    MongoUsergroupRepositoryFactory
} from "../../../src/userservice/repositories/usergroups";
import { TestCase, runMongoTest } from "@binders/binders-service-common/lib/mongo/test";
import { UserIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { Usergroup } from "../../../src/userservice/models/usergroup";

function runUsergroupTest<C>(testCase: TestCase<IUsergroup, C>) {
    return runMongoTest(
        "usergroups",
        (collectionConfig, logger) => Promise.resolve(new MongoUsergroupRepositoryFactory(collectionConfig, logger)),
        testCase
    );
}

function getData() {
    const g1 = Usergroup.create("usergroup-1234");
    const g2 = Usergroup.create("second-usergroup");
    return {
        aid1: "aid-123",
        aid2: "aid-456",
        group1: g1,
        details1: {
            group: g1,
            members: [],
            memberCount: 0
        },
        group2: g2,
        uid1: UserIdentifier.generate(),
        uid2: UserIdentifier.generate()
    };
}

afterAll(() => mongoose.disconnect());

describe("usergroup crud", () => {
    it("should create and retrieve a new group", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1, details1} = getData();
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedGroup => expect(retrievedGroup).toEqual(details1));
        });
    });
    it("should update the groupname correctly", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1, details1} = getData();
            const updatedName = "updatedName";
            const updatedGroup = group1.updateName(updatedName);
            const updatedDetails = Object.assign({}, details1, {group: updatedGroup});
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.saveUsergroup(aid1, updatedGroup))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedGroup => expect(retrievedGroup).toEqual(updatedDetails))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups.length).toEqual(1));
        });
    });
    it("should add and remove members correctly", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1, group2, uid1, uid2} = getData();
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.saveUsergroup(aid1, group2))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members).toEqual([]);
                    expect(retrievedDetails.memberCount).toBe(0);
                })
                .then(() => repo.getUsergroup(aid1, group2.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members).toEqual([]);
                    expect(retrievedDetails.memberCount).toBe(0);
                })
                .then(() => repo.addGroupMemberInAccount(aid1, group1.id, uid1))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members.map(user => user.value())).toEqual([uid1.value()]);
                    expect(retrievedDetails.memberCount).toBe(1);
                })
                .then(() => repo.getUsergroup(aid1, group2.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members).toEqual([]);
                    expect(retrievedDetails.memberCount).toBe(0);
                })
                .then(() => repo.addGroupMemberInAccount(aid1, group1.id, uid2))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members.length).toEqual(2);
                    expect(retrievedDetails.memberCount).toBe(2);
                })
                .then(() => repo.removeGroupMemberInAccount(aid1, group1.id, uid1))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members.length).toEqual(1);
                    expect(retrievedDetails.memberCount).toBe(1);
                })
                .then(() => repo.getUsergroup(aid1, group2.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members).toEqual([]);
                    expect(retrievedDetails.memberCount).toBe(0);
                })
                .then(() => repo.removeGroupMemberInAccount(aid1, group1.id, uid2))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.members.length).toEqual(0);
                    expect(retrievedDetails.memberCount).toBe(0);
                });
        });
    });
    it ("shouldn't add same user twice", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1, uid1} = getData();
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.addGroupMemberInAccount(aid1, group1.id, uid1))
                .then(() => repo.addGroupMemberInAccount(aid1, group1.id, uid1))
                .then(() => repo.getUsergroup(aid1, group1.id))
                .then(retrievedDetails => {
                    expect(retrievedDetails.memberCount).toEqual(1);
                    expect(retrievedDetails.members.map(member => member.value())).toEqual([uid1.value()]);
                });
        });
    });
    it ("should retrieve the correct groups for an account", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1, group2} = getData();
            return repo.getUsergroups(aid1)
                .then(retrievedGroups => expect(retrievedGroups).toEqual([]))
                .then(() => repo.saveUsergroup(aid1, group1))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups.map(group => group.group)).toEqual([group1]))
                .then(() => repo.saveUsergroup(aid1, group2))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups.length).toEqual(2))
                .then(() => repo.deleteUsergroup(aid1, group1.id))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups.map(group => group.group)).toEqual([group2]));
        });
    });
    it ("should not allow two active groups with the same name", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, aid2, group1} = getData();
            const sameNameGroup = Usergroup.create(group1.name);
            const otherSameNameGroup = Usergroup.create(group1.name);
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.saveUsergroup(aid1, sameNameGroup))
                .then(
                    () => expect(false).toBe(true),
                    _error => expect(true).toBe(true)
                )
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(group1))
                .then(() => repo.saveUsergroup(aid2, sameNameGroup))
                .then(() => repo.deleteUsergroup(aid1, group1.id))
                .then(() => repo.saveUsergroup(aid1, otherSameNameGroup))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(otherSameNameGroup));
        });
    });
    it ("should restore a group correctly", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1} = getData();
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(group1))
                .then(() => repo.deleteUsergroup(aid1, group1.id))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups).toEqual([]))
                .then(() => repo.restoreUsergroup(aid1, group1.id))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(group1));
        });
    });
    it ("should not restore a group if the name is reused", () => {
        return runUsergroupTest( (repo: MongoUsergroupRepository) => {
            const {aid1, group1} = getData();
            const sameNameGroup = Usergroup.create(group1.name);
            return repo.saveUsergroup(aid1, group1)
                .then(() => repo.deleteUsergroup(aid1, group1.id))
                .then(() => repo.saveUsergroup(aid1, sameNameGroup))
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(sameNameGroup))
                .then(() => repo.restoreUsergroup(aid1, group1.id))
                .then(
                    () => expect(false).toEqual(true),
                    _error => expect(true).toEqual(true)
                )
                .then(() => repo.getUsergroups(aid1))
                .then(retrievedGroups => expect(retrievedGroups[0].group).toEqual(sameNameGroup));
        });
    });

});