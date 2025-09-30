import * as React from "react";
import { DECORATORS } from "@binders/client/lib/draftjs/constants";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import i18next from "@binders/client/lib/react/i18n"


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createLink(contentState, url, text, target, isCallToLink, pasted = false, mutability = "IMMUTABLE") {
    const contentStateWithEntity = contentState.createEntity(
        DECORATORS.LINK,
        mutability,
        {
            pasted,
            target,
            isCallToLink,
            text,
            url: isCallToLink ? `${i18next.t(TranslationKeys.General_TelephoneAbbr)}:${url}` : url,
        },
    );
    return contentStateWithEntity.getLastCreatedEntityKey();
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function component({ contentState, entityKey, children }) {
    const { url } = contentState.getEntity(entityKey).getData();
    return (
        <a href={url} style={{ textDecoration: "underline" }}>
            {children}
        </a>
    );
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function strategy(contentBlock, callback, contentState) {
    contentBlock.findEntityRanges(
        (character) => {
            const key = character.getEntity();
            return ((key) && contentState.getEntity(key).getType() === DECORATORS.LINK);
        },
        callback,
    );
}
