/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
    tcombValidate,
    validatePositiveInt,
    validateStringInput,
    validateStringPrefix
} from "../../validation";
import { TranslationKeys } from "../../../i18n/translations";
import { VisualUsage } from "./contract";
import i18next from "../../../i18n";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const t = require("tcomb");

export function validateLogoId(candidate) {
    return validateStringPrefix(candidate, "logo-", i18next.t(TranslationKeys.Visual_WrongLogoId));
}

export function validateKeyFrame(candidate): string[] {
    const typeErrors = [];
    if (validateStringInput(candidate).length > 0) {
        typeErrors.push(i18next.t(TranslationKeys.Visual_KeyframeNotStringError));
        return typeErrors;
    }
    // tslint:disable:no-null-keyword
    if (candidate.match(/KEY_FRAME_[1-9]/i) === null) {
        typeErrors.push(i18next.t(TranslationKeys.Visual_WrongKeyframeFormat));
    }
    return typeErrors;
}

export function validateImageRotation(candidate: string | undefined): string[] {
    if (candidate === undefined) {
        return [];
    }

    try {
        const rotation = parseInt(candidate);
        const isPositiveInt = validatePositiveInt(rotation);
        if (isPositiveInt.length > 0) {
            return isPositiveInt;
        }
        return rotation % 90 > 0 ?  [i18next.t(TranslationKeys.Visual_WrongRotationFormat)] : [];
    } catch (e) {
        return [e];
    }
}

export const VideoIndexerResultFilterStucture = t.struct(
    {
        visualIds: t.maybe(t.list(t.String)),
    },
    "videoIndexerResultFilter"
);

export const UploadVisualOptionsStructure = t.struct(
    {
        visualUsage: t.maybe(t.enums.of(Object.values(VisualUsage))),
        commentId: t.maybe(t.String),
    },
    "uploadVisualOptions"
);

const HardDeleteVisualsMultiFilterStructure = t.struct(
    {
        binderIds: t.list(t.String),
    },
    "hardDeleteVisualsFilter"
)

export function videoIndexerResultFilterStr(filterStr: string): string[] {
    const filter = JSON.parse(filterStr);
    return tcombValidate(filter, VideoIndexerResultFilterStucture);
}

export function validateUploadVisualOptions(candidate: unknown): string[] {
    return tcombValidate(candidate, UploadVisualOptionsStructure);
}

export function validateHardDeleteVisualsMultiFilter(candidate: unknown): string[] {
    return tcombValidate(candidate, HardDeleteVisualsMultiFilterStructure);
}