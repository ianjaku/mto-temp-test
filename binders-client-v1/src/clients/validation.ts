/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as validator from "validator";
import { AuditLogType, IUserActionFilter, UserActionType } from "./trackingservice/v1/contract";
import { USER_GROUP_IDENTIFIER_PREFIX, USER_IDENTIFIER_PREFIX } from "./userservice/v1/constants";
import { AccountSortMethod } from "./accountservice/v1/contract";
import { TranslationKeys } from "../i18n/translations";
import { UNDEFINED_LANG } from "../util/languages";
import i18next from "../i18n";
import { isManualToLogin } from "../util/user";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tValidation = require("tcomb-validation");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export type Validator = (any) => string[];
export type StringValidator = (string) => string[];
export type ValidationOptions = {
    canBeMissingIfProvided?: string[];
};

type requiredness = "optional";

export type ValidationRule = |
// eslint-disable-next-line @typescript-eslint/ban-types
[(Request) => Object, string, Validator, requiredness?] |
// eslint-disable-next-line @typescript-eslint/ban-types
[(Request) => Object, string, Validator, ValidationOptions]; // hacky type declaration because optional elements in tuples aren't allowed in typescript < 3.0, see https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-0.html#optional-elements-in-tuple-types

export const validationOk: string[] = [];

export function fromHeaders(req: Request) {
    return req.headers;
}

export function fromParams(req) {
    return req.params;
}

export function fromBody(req) {
    return req.body;
}

export function fromQuery(req) {
    return req.query;
}

export function validateNullOr(candidate, validator: (c) => string[]): string[] {
    if (candidate === null) {
        return [];
    }
    return validator(candidate);
}

export function validateEmailInput(emailCandidate: string): string[] {
    if (!validator.isEmail(emailCandidate)) {
        return [i18next.t(TranslationKeys.General_InvalidEmail, { email: emailCandidate })];
    } else {
        return validationOk;
    }
}

export function validateNonManualToEmailInput(emailCandidate: string): string[] {
    const emailValidationResponse = validateEmailInput(emailCandidate);
    if (emailValidationResponse.length === 0) {
        if (isManualToLogin(emailCandidate)) {
            return [i18next.t(TranslationKeys.User_NotAllowedEmailDomain)];
        }
    }
    return emailValidationResponse;
}

export function validateNumberInput(stringCandidate): string[] {
    if (typeof stringCandidate === "number") {
        return validationOk;
    } else {
        return [i18next.t(TranslationKeys.General_InvalidNumeric, { string: stringCandidate })];
    }
}

export function validateStringInput(stringCandidate): string[] {
    if (typeof stringCandidate === "string") {
        return validationOk;
    } else {
        return [i18next.t(TranslationKeys.General_InvalidString, { string: stringCandidate })];
    }
}

export function validateWithString(stringCandidate, validator: StringValidator): string[] {
    const stringValidationErrors = validateStringInput(stringCandidate);
    if (stringValidationErrors.length > 0) {
        return stringValidationErrors;
    }
    const stringCandidateString = <string>stringCandidate;
    return validator(stringCandidateString);
}

export function validateStringPrefix(stringCandidate, prefix: string, errorMessage: string): string[] {
    return validateWithString(stringCandidate, stringCandidateString => {
        if (stringCandidateString.startsWith(prefix)) {
            return validationOk;
        } else {
            return [errorMessage];
        }
    });
}

export const UserId = t.refinement(t.String, s => s.startsWith(USER_IDENTIFIER_PREFIX));
export const UserIdOrPublic = t.refinement(t.String, s => s.startsWith(USER_IDENTIFIER_PREFIX) || s === "public");
export const UserIdOrGroupId = t.refinement(t.String, s => s.startsWith(USER_IDENTIFIER_PREFIX) || s.startsWith(USER_GROUP_IDENTIFIER_PREFIX));
export const AclId = t.refinement(t.String, s => s.startsWith("acl-"));
export const AccountId = t.refinement(t.String, s => s.startsWith("aid-"));
export const SessionId = t.refinement(t.String, s => s.startsWith("sid-"));
export const SemanticlinkId = t.refinement(t.String, s => s.startsWith("sli-"));

export const AclRestrictionSetStruct = t.struct({
    languageCodes: t.maybe(t.list(t.String)),
});

export function validateUserId(userIdCandidate): string[] {
    return tcombValidate(userIdCandidate, UserIdOrPublic, `${i18next.t(TranslationKeys.User_InvalidUserId)} ${userIdCandidate}`);
}
export function validateUserIds(userIdCandidates): string[] {
    const errors = userIdCandidates.map(userId => validateUserId(userId));
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], errors); // flatten the error array
}

export function validateGroupAndUserIds(candidates: unknown[]): string[] {
    for (const candidate of candidates) {
        const errors = tcombValidate(candidate, UserIdOrGroupId, `${i18next.t(TranslationKeys.User_InvalidUserGroupIdInArray, { candidates })}`);
        if (errors.length > 0) return errors;
    }
    return [];
}

export function validateUsergroupIds(groupIdCandidates): string[] {
    const errors = groupIdCandidates.map(gId => validateUsergroupId(gId));
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], errors); // flatten the error array
}

export function validateUsergroupId(groupIdCandidate): string[] {
    return validateStringPrefix(groupIdCandidate, USER_GROUP_IDENTIFIER_PREFIX, i18next.t(TranslationKeys.User_InvalidGroupId));
}

export function validateUserOrUsergroupId(idCandidate): string[] {
    const uErr = validateUserId(idCandidate);
    const gErr = validateUsergroupId(idCandidate);
    if (uErr.length && gErr.length) {
        return [`Not a userId nor a userGroupId: ${idCandidate}`];
    }
    return [];
}

export function validateNotificationTargetId(candidate): string[] {
    return validateStringPrefix(candidate, "ntid-", i18next.t(TranslationKeys.Notification_InvalidTargetId));
}

export function validateAclId(aclIdCanddiate): string[] {
    return validateStringPrefix(aclIdCanddiate, "acl-", i18next.t(TranslationKeys.Acl_InvalidId));
}

export function validateAclRestrictionSet(candidate): string[] {
    if (!candidate) {
        return [];
    }
    return tcombValidate(candidate, AclRestrictionSetStruct);
}

export function validateAccountId(accountIdCandidate): string[] {
    return validateStringPrefix(accountIdCandidate, "aid-", `${i18next.t(TranslationKeys.Account_InvalidId)} ${accountIdCandidate}`);
}

export function validateLogType(logTypeCandidate): string[] {
    return validateWithString(`${logTypeCandidate}`, candidate => {
        if (Object.keys(AuditLogType).includes(candidate)) {
            return validationOk;
        }
        return [`Unknown AuditLogType ${candidate}`];
    });
}

export function validateSortMethod(sortMethodCandidate): string[] {
    return tcombValidate(
        sortMethodCandidate,
        t.refinement(t.String, (s: string) => (Object.values(AccountSortMethod) as string[]).includes(s.toLowerCase()))
    );
}

export function validateCustomerId(customerIdCandidate): string[] {
    return validateStringPrefix(customerIdCandidate, "cus-", `Not a valid customer id: ${customerIdCandidate}`);
}

export function validateRoleId(roleIdCandidate): string[] {
    return validateStringPrefix(roleIdCandidate, "rol-", i18next.t(TranslationKeys.Acl_InvalidRoleId));
}

export function validateAccountIdArrayInput(accountIdArrayCandidate, candidateName: string): string[] {
    if (!Array.isArray(accountIdArrayCandidate)) {
        return [i18next.t(TranslationKeys.General_NotArrayError, { candidateName })];
    }
    return accountIdArrayCandidate.reduce(
        (reduced, stringCandidate) => reduced.concat(validateAccountId(stringCandidate)),
        []
    );
}

export function validateAccountIds(accountIdCandidates): string[] {
    const errors = accountIdCandidates.map(accountId => validateAccountId(accountId));
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], errors); // flatten the array
}

export function validateSessionId(sessionIdCandidate): string[] {
    return validateStringPrefix(sessionIdCandidate, "sid-", i18next.t(TranslationKeys.General_InvalidSessionId));
}

export function validatePasswordInput(passwordCandidate): string[] {
    const stringValidationErrors = validateStringInput(passwordCandidate);
    if (stringValidationErrors.length > 0) {
        return stringValidationErrors;
    }
    const minPasswordLength = 6;
    const errors = [];
    if (passwordCandidate.length < minPasswordLength) {
        errors.push(i18next.t(TranslationKeys.User_MinPasswordLengthError, { minPasswordLength }));
    }
    return errors;
}

export function validateLoginInput(login: string) {
    return validateEmailInput(login);
}

export function validateNonManualToLoginInput(login: string) {
    return validateNonManualToEmailInput(login);
}

const validSubscriptionTypes = ["trial", "standard"];

export function validateSubscriptionType(subscriptionTypeCandidate: string) {
    return validateWithString(subscriptionTypeCandidate, subscriptionTypeCandidateString => {
        if (validSubscriptionTypes.indexOf(subscriptionTypeCandidateString) === -1) {
            return [i18next.t(TranslationKeys.General_InvalidSubscriptionType, { subscription: subscriptionTypeCandidateString })];
        } else {
            return validationOk;
        }
    });
}


export function validateUserActionFilter(filterCandidate: IUserActionFilter): string[] {
    return validateAccountId(filterCandidate?.accountId);
}

export function validateUserActionType(candidate: string): string[] {
    if (UserActionType[candidate] == null) {
        return [i18next.t(TranslationKeys.General_InvalidUserActionType) + " " + candidate];
    }
    return []
}

export function validateISODate(dateCandidate: string) {
    return validateWithString(dateCandidate, dateCandidateString => {
        if (isNaN(Date.parse(dateCandidateString))) {
            return [i18next.t(TranslationKeys.General_InvalidDate, { date: dateCandidateString })];
        } else {
            return validationOk;
        }
    });
}

export function validateBoolean(boolCandidate): string[] {
    if (typeof boolCandidate !== "boolean") {
        return [i18next.t(TranslationKeys.General_InvalidBool, { bool: boolCandidate })];
    }
    return [];
}

export function validateBinderId(binderIdCandidate) {
    return validateStringInput(binderIdCandidate);
}
export function validateCollectionId(collectionIdCandidate) {
    return validateStringInput(collectionIdCandidate);
}
export function validatePublicationId(publicationIdCandidate) {
    return validateStringInput(publicationIdCandidate);
}
export function validateBinderIds(binderIdCandidates): string[] {
    const errors = binderIdCandidates.map(binderId => validateBinderId(binderId));
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], errors); // flatten the array
}

export function validateImageId(imageIdCandidate) {
    return validateStringInput(imageIdCandidate);
}

export function validateVisualId(visualIdCandidate) {
    return validateStringInput(visualIdCandidate);
}

export function validateVisualIds(visualIdsCandidate) {
    if (!Array.isArray(visualIdsCandidate)) {
        return [i18next.t(TranslationKeys.General_NotArrayError, { candidateName: "videoIds" })];
    }
    return visualIdsCandidate.flatMap(visualId => validateVisualId(visualId));
}

export function validateItemId(id: string) {
    return validateStringInput(id);
}

export function validateItemIds(candidates: string[]) {
    const errors = candidates.map(id => validateItemId(id));
    return errors.flatMap(e => e);
}

const validVisualFitBehaviours = ["fit", "crop"];

export function validateVisualFitBehaviour(visualFitBehaviourCandidate) {
    return validateWithString(visualFitBehaviourCandidate, visualFitBehaviourCandidateString => {
        if (validVisualFitBehaviours.indexOf(visualFitBehaviourCandidateString) === -1) {
            return [i18next.t(TranslationKeys.Visual_InvalidFitBehaviour, { behaviour: visualFitBehaviourCandidateString })];
        }
        return [];
    });
}

export function validateHexColorOrTransparent(colorCandidate): string[] {
    if (colorCandidate !== "transparent" && !validator.isHexColor(colorCandidate)) {
        return [i18next.t(TranslationKeys.Visual_InvalidHexColor, { color: colorCandidate })];
    } else {
        return validationOk;
    }
}

export function validateMultiAddMembersOptions(candidate) {
    return tcombValidate(candidate, MultiAddMembersOptionsStructure);
}

export function validateUserGroupsQuery(candidate) {
    return tcombValidate(candidate, UserGroupsQueryStructure);
}

export function validateImageFormat(formatCandidate): string[] {
    if (typeof formatCandidate !== "object") {
        return [i18next.t(TranslationKeys.Visual_ImageFormatNotObjectError, { type: typeof formatCandidate })];
    }

    const missingKeys = ["name", "width", "height", "size", "storageLocation"].reduce((acc, prop) => {
        if (!(prop in formatCandidate)) {
            acc.push(i18next.t(TranslationKeys.General_MissingProperty, { prop }));
        }
        return acc;
    }, []);
    if (missingKeys.length > 0) {
        return missingKeys;
    }

    const typeErrors = [];
    if (validateStringInput(formatCandidate["name"]).length > 0) {
        typeErrors.push(i18next.t(TranslationKeys.General_NamePropStringError));
    }
    if (validateStringInput(formatCandidate["storageLocation"]).length > 0) {
        typeErrors.push(i18next.t(TranslationKeys.General_StorageLocationPropStringError));
    }
    return ["width", "height", "size"].reduce((acc, prop) => {
        if (typeof formatCandidate[prop] !== "number") {
            acc.push(i18next.t(TranslationKeys.General_PropertyNotNumberError, { prop }));
        } else {
            if (formatCandidate[prop] < 0) {
                acc.push(i18next.t(TranslationKeys.General_PropertyNotPositiveNumberError, { prop }));
            }
        }
        return acc;
    }, typeErrors);
}

export function validateVisualSize(sizeCandidate): string[] {
    return validateWithString(sizeCandidate, sizeCandidateString => {
        if (
            [
                "THUMBNAIL",
                "ORIGINAL",
                "MEDIUM",
                "SCREENSHOT",
                "VIDEO_SCREENSHOT_MEDIUM",
                "VIDEO_SCREENSHOT",
                "VIDEO_SCREENSHOT_BIG",
                "VIDEO_SCREENSHOT_BIG_2",
                "VIDEO_SCREENSHOT_HUGE",
                "VIDEO_WEB_DEFAULT",
                "VIDEO_DEFAULT_HD",
                "VIDEO_DEFAULT_SD",
                "VIDEO_DEFAULT_LD",
                "VIDEO_IPHONE",
                "VIDEO_IPHONE_HD",
                "VIDEO_IPHONE_SD",
                "MEDIUM2",
                "BIG",
                "HUGE",
                "TINY",
            ].indexOf(
                sizeCandidateString.toUpperCase()
            ) === -1
        ) {
            return [i18next.t(TranslationKeys.Visual_InvalidSize, { size: sizeCandidate })];
        }
        return [];
    });
}

export function validateScreenshotSize(sizeCandidate): string[] {
    return validateWithString(sizeCandidate, sizeCandidateString => {
        if ([
            "VIDEO_SCREENSHOT",
            "VIDEO_SCREENSHOT_MEDIUM",
            "VIDEO_SCREENSHOT_BIG",
            "VIDEO_SCREENSHOT_BIG_2",
            "VIDEO_SCREENSHOT_HUGE",
        ].indexOf(sizeCandidateString.toUpperCase()) === -1) {
            return [i18next.t(TranslationKeys.Visual_InvalidScreenshotSize, { size: sizeCandidate })];
        }
        return [];
    });
}

export function validateQuery(queryCandidate): string[] {
    return validateStringInput(queryCandidate);
}

function splitCsv(csv: string): string[] {
    return csv?.split(",").map(x => x.trim()).filter(x => x.length > 0) ?? [];
}

export function validateCommaSeparatedArrayInput(validateValue: (val: string) => string[]) {
    return function(csvStringCandidate, _candidateName?: string): string[] {
        const stringArrayCandidate = splitCsv(csvStringCandidate);
        if (!Array.isArray(stringArrayCandidate)) {
            return [i18next.t(TranslationKeys.General_NotArrayError)];
        }
        return stringArrayCandidate.reduce(
            (reduced, stringCandidate) => reduced.concat(validateValue(stringCandidate)),
            []
        );
    }
}

export function validateOptional(validator) {
    return function(candidate, _candidateName?: string): string[] {
        if (!candidate?.length) { return []; }
        return validator(candidate);
    }

}

export function validateStringArrayInput(stringArrayCandidate, _candidateName?: string): string[] {
    if (!Array.isArray(stringArrayCandidate)) {
        return [i18next.t(TranslationKeys.General_NotArrayError)];
    }
    return stringArrayCandidate.reduce(
        (reduced, stringCandidate) => reduced.concat(validateStringInput(stringCandidate)),
        []
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateNumberArrayInput(stringArrayCandidate, candidateName: string): string[] {
    if (!Array.isArray(stringArrayCandidate)) {
        return [i18next.t(TranslationKeys.General_NotArrayError)];
    }
    return stringArrayCandidate.reduce(
        (reduced, stringCandidate) => reduced.concat(validateNumberInput(stringCandidate)),
        []
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateBinderIdArrayInput(binderIdArrayCandidate, candidateName: string): string[] {
    if (!Array.isArray(binderIdArrayCandidate)) {
        return [i18next.t(TranslationKeys.General_NotArrayError)];
    }
    return binderIdArrayCandidate.reduce(
        (reduced, binderIdCandidate) => reduced.concat(validateBinderId(binderIdCandidate))
        , []
    );
}

/* tslint:disable-next-line:variable-name */
export const BinderSearchResultOptionsStructure = t.struct(
    {
        maxResults: t.Number,
        orderBy: t.maybe(t.String),
        ascending: t.maybe(t.Boolean),
        permissionName: t.maybe(t.Number)
    },
    "Search result options"
);

export const AncestorThumbnailsOptionsStructure = t.struct(
    {
        inheritAncestorThumbnails: t.maybe(t.Boolean),
        directParentCollectionId: t.maybe(t.String)
    },
    "Ancestor thumbnails options"
);

/* tslint:disable-next-line:variable-name */
export const ItemSearchOptionsStructure = t.struct(
    {
        binderSearchResultOptions: BinderSearchResultOptionsStructure,
        ancestorThumbnailsOptions: t.maybe(AncestorThumbnailsOptionsStructure)
    },
    "Search result options"
);

/* tslint:disable-next-line:variable-name */
export const MultiAddMembersOptionsStructure = t.struct(
    {
        doSync: t.maybe(t.Boolean),
    },
    "multiadd members options"
);

export const CollectionElementsWithInfoOptionsStructure = t.struct(
    {
        cdnnify: t.maybe(t.Boolean),
        preferredLanguageCodes: t.maybe(t.list(t.String)),
    },
    "CollectionElementsWithInfoOptions"
);

export const UserGroupsQueryStructure = t.struct(
    {
        names: t.maybe(t.list(t.String)),
    },
    "usergroups query"
);

export function validateBindersSearchResultOptions(optionsCandidate): string[] {
    return tcombValidate(optionsCandidate, BinderSearchResultOptionsStructure);
}

export function validateItemSearchOptions(optionsCandidate): string[] {
    return tcombValidate(optionsCandidate, ItemSearchOptionsStructure);
}

export function validateCollectionElementsWithInfoOptions(cand): string[] {
    return tcombValidate(cand, CollectionElementsWithInfoOptionsStructure);
}

export function validateDocumentCollectionId(collectionIdCandidate): string[] {
    return validateStringInput(collectionIdCandidate);
}

export function validateIncludesAccountFilterKeys(candidate): string[] {
    const { accountId, accountIds, domain } = candidate;
    if (accountId) {
        return validateAccountId(accountId);
    }
    if (accountIds) {
        return validateAccountIds(accountIds);
    }
    if (domain) {
        return validateDomain(domain);
    }
    return [i18next.t(TranslationKeys.General_NoKeyForFilter)]
}

export function validateDocumentCollectionIds(collectionIdCandidates): string[] {
    const errors = collectionIdCandidates.map(docId => validateDocumentCollectionId(docId));
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], errors); // flatten the array
}

export function tcombValidate(candidate, struct, errorMessage?: string) {
    const validationResult = tValidation.validate(candidate, struct);
    if (!validationResult.isValid()) {
        return errorMessage || validationResult.errors.map(err => err.message);
    }
    return validationOk;
}

export function validateLanguageCode(codeCandidate): string[] {
    return validateWithString(codeCandidate, str => {
        if (str === UNDEFINED_LANG) {
            return [];
        }
        const parts = str.split("-");
        if (
            parts.length > 2 ||
            (parts[0].length !== 2 && parts[0].length !== 3)
        ) {
            return [i18next.t(TranslationKeys.General_InvalidLangCode, { lang: str })];
        }
        return [];
    });
}

export function validateCommentEdits(candidate: unknown): string[] {
    if (typeof candidate !== "object") {
        return ["Unrecognized comment edits params"];
    }
    const validationResult: string[] = [];
    validationResult.push(...validateStringInput(candidate["text"]));
    if ("attachmentIdsForRemoval" in candidate) {
        validationResult.push(...validateStringArrayInput(candidate["attachmentIdsForRemoval"]));
    }
    return validationResult;
}

export function validateLanguageCodes(candidates) {
    if (!(candidates instanceof Array)) {
        return [i18next.t(TranslationKeys.General_LangCodesNotArrayError)];
    }
    const candidateErrors = candidates.map(validateLanguageCode).filter(errors => errors.length > 0);
    // eslint-disable-next-line prefer-spread
    return [].concat.apply([], candidateErrors);
}

export function validatePositiveInt(intCandidate): string[] {
    if (typeof intCandidate !== "number") {
        return [i18next.t(TranslationKeys.General_InvalidNumeric, { int: intCandidate })];
    }
    if (intCandidate % 1 !== 0) {
        return [i18next.t(TranslationKeys.General_InvalidInteger, { int: intCandidate })];
    }
    if (intCandidate < 0) {
        return [i18next.t(TranslationKeys.General_InvalidNegative, { int: intCandidate })];
    }
    return [];
}

export function validateDomain(domainCandidate): string[] {
    if (process.env.NODE_ENV !== "production") {
        return validationOk;
    }
    return validator.isFQDN(domainCandidate, { allow_underscores: true }) ?
        [] :
        [i18next.t(TranslationKeys.General_InvaliDomain, { domain: domainCandidate })];
}

export function validateArrayInput(
    candidateName: string,
    elementValidator: (candidate: unknown) => string[]
): (arrayCandidate: unknown[]) => string[] {
    return function(arrayCandidate: unknown): string[] {
        if (!Array.isArray(arrayCandidate)) {
            return [i18next.t(TranslationKeys.General_NotArrayError, { candidateName })];
        }
        return arrayCandidate.reduce((reduced, candidate) => reduced.concat(elementValidator(candidate)), [] as string[]);
    };
}

export function validateDocumentAndCollectionTitles(titleCandidate: string, maxTitleLength: number): string[] {
    const errors = [];
    if (titleCandidate.length >= maxTitleLength) {
        errors.push(i18next.t(TranslationKeys.General_TooLingTitleError, { maxTitleLength }));
    }
    return errors;
}

export function validateFontWeight(fontWeightCandidate): string[] {
    // todo: it should be type...
    const weights = ["bold", "regular", "thin", "super", "light", "medium"];
    return weights.indexOf(fontWeightCandidate.toLowerCase()) >= 0 ?
        [] :
        [i18next.t(TranslationKeys.General_InvalidFontWeightValue, { fontWeightCandidate })];
}

export function validateFontStyle(fontStyleCandidate): string[] {
    const weights = ["normal", "italic"];
    return weights.indexOf(fontStyleCandidate.toLowerCase()) >= 0 ?
        [] :
        [i18next.t(TranslationKeys.General_InvalidFontStyleValue, { fontStyleCandidate })];
}

export function validateMaybePositiveNumber(candidate): string[] {
    if (candidate === undefined) {
        return [];
    }
    try {
        const nr = parseFloat(candidate);
        if (nr <= 0) {
            return [i18next.t(TranslationKeys.General_PropertyNotPositiveNumberError, { prop: candidate })];
        }
    } catch (err) {
        return [i18next.t(TranslationKeys.General_NotValidNumber, { candidate })];
    }

    return [];
}

export function validateInteger(candidate: string): string[] {
    const number = parseInt(candidate);
    if (isNaN(number)) {
        return [`Not a valid number ${candidate}`];
    }
    return validationOk;
}

export function validateIntegerInInterval(candidate: string, inclusiveLowerBound: number, inclusiveUpperBound: number): string[] {
    const number = parseInt(candidate);
    if (isNaN(number)) {
        return [`Not a valid number ${candidate}`];
    }
    if (number < inclusiveLowerBound || number > inclusiveUpperBound) {
        return [`Value ${candidate} is outside [${inclusiveLowerBound}, ${inclusiveUpperBound}] interval`];
    }
    return validationOk;
}

export function validateObjectIncludes(candidate, requiredKey: string, paramName: string): string[] {
    return candidate[requiredKey] ?
        validationOk :
        [i18next.t(TranslationKeys.General_KeyNotIncluded, { paramName, requiredKey })];
}

export function validateOneOf(allowed: string[]): (candidate: string) => string[] {
    return (candidate) => {
        if (!allowed.includes(candidate)) {
            return [`Not a valid value ${candidate}. Should be one of ${allowed.join(", ")}`];
        }
        return validationOk;
    }
}

export function validateSemanticLinkId(semLinkIdCandidate): string[] {
    return tcombValidate(
        semLinkIdCandidate,
        SemanticlinkId,
        `Invalid semanticlink id: ${semLinkIdCandidate}`,
    );
}

function validateIsAnonymous(candidate): string[] {
    const result = validateBoolean(candidate);
    if (result.length) {
        return ["Invalid or missing value for isAnonymous"];
    }
    return validationOk;
}

function validateFeedbackRating(candidate): string[] {
    if (candidate == null || candidate == "") {
        return validationOk;
    }
    return validateIntegerInInterval(candidate, 1, 5);
}

function validateFeedbackMessage(candidate): string[] {
    if (candidate == null) {
        return validationOk;
    }
    return validateStringInput(candidate);
}

export function validateFeedbackParams(candidate): string[] {
    if (typeof candidate !== "object") {
        return ["Unrecognized feedback params value"];
    }
    const validationResult: string[] = [];
    validationResult.push(...validateIsAnonymous(candidate.isAnonymous));
    if (!candidate.rating && !candidate.message) {
        validationResult.push("Neither the rating nor the message have values");
    } else {
        validationResult.push(...validateFeedbackRating(candidate.rating));
        validationResult.push(...validateFeedbackMessage(candidate.message));
    }
    return validationResult;
}

export function validateRotation(rotationCandidate): string[] {
    if (typeof rotationCandidate !== "number") {
        return [ i18next.t(TranslationKeys.General_InvalidNumeric, { int: rotationCandidate} ) ];
    }
    if (![0, 90, 180, 270].includes(rotationCandidate)) {
        return [ i18next.t(TranslationKeys.Visual_WrongRotationFormat) ];
    }
    return [];
}


export function validateVisualSettings(candidate): string[] {
    if (typeof candidate !== "object") {
        return ["Unrecognized visual settings value"];
    }
    const validationResult: string[] = [];
    if (candidate.fitBehaviour) {
        validationResult.push(...validateVisualFitBehaviour(candidate.fitBehaviour));
    }
    if (candidate.bgColor !== undefined) {
        validationResult.push(...validateHexColorOrTransparent(candidate.bgColor));
    }
    if (candidate.languageCodes !== undefined) {
        validationResult.push(...validateLanguageCodes(candidate.languageCodes));
    }
    if (candidate.rotation !== undefined) {
        validationResult.push(...validateRotation(candidate.rotation));
    }
    if (candidate.audioEnabled !== undefined) {
        validationResult.push(...validateBoolean(candidate.audioEnabled));
    }
    if (candidate.autoPlay !== undefined) {
        validationResult.push(...validateBoolean(candidate.autoPlay));
    }
    return validationResult;
}

export const NonEmptyString = t.refinement(t.String, s => s.trim().length > 0, "NonEmptyString");