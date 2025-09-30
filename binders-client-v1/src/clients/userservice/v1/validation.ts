import { tcombValidate, validateStringPrefix } from "../../validation";
import { TranslationKeys } from "../../../i18n/translations";
import { USER_GROUP_IDENTIFIER_PREFIX } from "./constants";
import { UserType } from "./contract";
import i18next from "../../../i18n";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

const UserPreferencesStruct = t.struct({
    readerLanguages: t.maybe(t.list(t.String)),
    acknowledgementCookies: t.maybe(t.Boolean),
    defaultAnalyticsRange: t.maybe(t.String),
}, "UserPreferences");

const UserTagStruct = t.struct({
    type: t.String,
    id: t.String,
    name: t.String,
    value: t.String,
    context: t.String,
}, "UserTag");

const UserTagsFilter = t.maybe(t.struct({
    name: t.maybe(t.String),
    context: t.maybe(t.String)
}));

export function validateUserTagsFilter(candidate: unknown): string[] {
    return tcombValidate(candidate, UserTagsFilter);
}

export function validateUserPreferences(preferencesCandidate: unknown): string[] {
    return tcombValidate(preferencesCandidate, UserPreferencesStruct);
}

export function validateUserTag(userTagCandidate: unknown): string[] {
    return tcombValidate(userTagCandidate, UserTagStruct);
}

// tslint:disable-next-line:variable-name
const UserQuery = t.struct({
    login: t.maybe(t.String),
    name: t.maybe(t.String)
});

export function validateUserQuery(queryCandidate: unknown): string[] {
    return tcombValidate(queryCandidate, UserQuery);
}

export function validateUserType(candidate: unknown): string[] {
    return tcombValidate(candidate, t.enums.of(Object.keys(UserType)));
}

const SearchOptions = t.struct({
    maxResults: t.maybe(t.Number),
    orderBy: t.maybe(t.enums.of([
        "login",
        "name"
    ])),
    sortOrder: t.maybe(t.enums.of([
        "ascending",
        "descending"
    ]))
});

const UsersSearchByQueryOptions = SearchOptions.extend(
    {
        needsEditorAccess: t.maybe(t.Boolean),
    }
)

export function validateSearchOptions(optionsCandidate: unknown): string[] {
    return tcombValidate(optionsCandidate, SearchOptions);
}

export function validateUsersSearchByQueryOptions(candidate: unknown): string[] {
    return tcombValidate(candidate, UsersSearchByQueryOptions);
}

export function validateUsergroupId(groupIdCandidate: unknown): string[] {
    return validateStringPrefix(groupIdCandidate, USER_GROUP_IDENTIFIER_PREFIX, i18next.t(TranslationKeys.User_InvalidGroupId));
}