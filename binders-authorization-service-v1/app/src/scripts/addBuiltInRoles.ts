/* eslint-disable no-console */
import * as mongoose from "mongoose";
import { BindersConfig } from "@binders/binders-service-common/lib/bindersconfig/binders";
import { CollectionConfig } from "@binders/binders-service-common/lib/mongo/config";
import { LoggerBuilder } from "@binders/binders-service-common/lib/util/logging";
import { Maybe } from "@binders/client/lib/monad";
import { PermissionName } from "@binders/client/lib/clients/authorizationservice/v1/contract";
import { Role } from "./../authorization/models/roles";
import { RoleIdentifier } from "@binders/binders-service-common/lib/authentication/identity";
import { RoleRepositoryFactory } from "./../authorization/repositories/roles";

const config = BindersConfig.get();
const topLevelLogger = LoggerBuilder.fromConfig(config);

CollectionConfig.promiseFromConfig(config, "roles", Maybe.nothing<string>())
    .then(collectionConfig => {
        const factory = new RoleRepositoryFactory(collectionConfig, topLevelLogger);
        const repo = factory.build(topLevelLogger);

        const builtInRoles = [
            new Role(
                RoleIdentifier.generate().value(),
                "Reader",
                [PermissionName.VIEW],
                true,
                false,
                "123",
                "Reader description",
            ),
            new Role(
                RoleIdentifier.generate().value(),
                "Contributor",
                [
                    PermissionName.EDIT,
                    PermissionName.VIEW,
                ],
                true,
                false,
                "123",
                "Contributor description",
            ),
            new Role(
                RoleIdentifier.generate().value(),
                "Editor",
                [
                    PermissionName.PUBLISH,
                    PermissionName.EDIT,
                    PermissionName.VIEW,
                ],
                true,
                false,
                "123",
                "Editor description",
            ),
            new Role(
                RoleIdentifier.generate().value(),
                "Admin",
                [
                    PermissionName.ADMIN,
                    PermissionName.PUBLISH,
                    PermissionName.EDIT,
                    PermissionName.VIEW,
                ],
                true,
                false,
                "123",
                "Admin description",
            ),
            new Role(
                RoleIdentifier.generate().value(),
                "Reviewer",
                [
                    PermissionName.REVIEW,
                    PermissionName.EDIT,
                    PermissionName.VIEW,
                ],
                true,
                false,
                "123",
                "Reviewer description",
            ),
        ];
        return Promise.all(builtInRoles.map(repo.saveRole, repo));
    })
    .then((savedRoles) => {
        console.log("SUCCESS bro!")
        savedRoles.map(console.log);
        mongoose.disconnect()

    })
    .catch(err => {
        mongoose.disconnect();
        throw err;
    });