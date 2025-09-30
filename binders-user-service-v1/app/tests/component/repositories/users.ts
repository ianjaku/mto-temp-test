import * as mongoose from "mongoose";
import { IUser, MongoUserRepositoryFactory } from "../../../src/userservice/repositories/users";
import { TestCase, runMongoTest } from "@binders/binders-service-common/lib/mongo/test";
import { Login } from "@binders/binders-service-common/lib/authentication/identity";
import { MongoUserRepository } from "../../../src/userservice/repositories/users";
import { User } from "../../../src/userservice/models/user";

function runUserTest<C>(testCase: TestCase<IUser, C>) {
    return runMongoTest(
        "users",
        (collectionConfig, logger) => Promise.resolve(new MongoUserRepositoryFactory(collectionConfig, logger)),
        testCase
    );
}

afterAll(() => mongoose.disconnect());

function getData() {
    const login1 = "user1@manual.to";
    const name1 = "user1";
    const login2 = "faker@manual.to";
    const name2 = "user2";
    const login3 = "user@binders.media";
    const name3 = "fakename";
    return {
        login1,
        name1,
        user1: User.create({ login: new Login(login1), displayName: name1 }),
        login2,
        name2,
        user2: User.create({ login: new Login(login2), displayName: name2 }),
        login3,
        name3,
        user3: User.create({ login: new Login(login3), displayName: name3 }),
    };
}

describe("searching users", () => {
    it("should find the correct users", () => {
        return runUserTest( (repo: MongoUserRepository) => {
            const {login1, user1, user2, user3} = getData();
            return Promise.all([
                repo.saveUser(user1),
                repo.saveUser(user2),
                repo.saveUser(user3),
            ])
                .then(() => repo.searchUsers({login: login1}, {}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(1);
                    return expect(searchResult.hits).toEqual([user1]);
                })
                .then(() => repo.searchUsers({name: user2.displayName}, {}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(1);
                    return expect(searchResult.hits).toEqual([user2]);
                })
                .then(() => repo.searchUsers({login: "manual.to"}, {}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(2);
                    return expect(searchResult.hits).toEqual([user1, user2]);
                })
                .then(() => repo.searchUsers({name: "user"}, {}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(2);
                    return expect(searchResult.hits).toEqual([user1, user2]);
                });
        });
    });
    it("should use the options correctly", () => {
        return runUserTest( (repo: MongoUserRepository) => {
            const {login1: _login1, user1, user2, user3} = getData();
            return Promise.all([
                repo.saveUser(user1),
                repo.saveUser(user2),
                repo.saveUser(user3),
            ])
                .then(() => repo.searchUsers({}, {orderBy: "login"}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(3);
                    return expect(searchResult.hits).toEqual([user2, user1, user3]);
                })
                .then(() => repo.searchUsers({}, {orderBy: "name"}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(3);
                    return expect(searchResult.hits).toEqual([user3, user1, user2]);
                })
                .then(() => repo.searchUsers({}, {orderBy: "login", maxResults: 1}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(3);
                    return expect(searchResult.hits).toEqual([user2]);
                })
                .then(() => repo.searchUsers({}, {orderBy: "login", maxResults: 1, sortOrder: "ascending"}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(3);
                    return expect(searchResult.hits).toEqual([user2]);
                })
                .then(() => repo.searchUsers({}, {orderBy: "login", maxResults: 1, sortOrder: "descending"}))
                .then(searchResult => {
                    expect(searchResult.hitCount).toEqual(3);
                    return expect(searchResult.hits).toEqual([user3]);
                });
        });
    });
});