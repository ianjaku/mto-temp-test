
export const FONT_SIZE_PREFIX = "FONT_SIZE_";
export const FONT_SIZE_MINIMUM = 40;
export const FONT_SIZE_MAXIMUM = 300;
export const FONT_SIZE_INCREASE = 20;

export const CHARACTERS = {
    NON_BREAKING_SPACE: "\u00a0",
};

export const DECORATORS = {
    LINK: "link",
};

export const KEY_COMMANDS = {
    LINK: "create-link",
    NON_BREAKING_SPACE: "create-non-breaking-space",
};

export const REGEXPS = {
    // eslint-disable-next-line
    LINK: /^(?:\w+:)?\/\/([^\s\.]+\.\S{2}|localhost[\:?\d]*)\S*$/,
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildStyleMap() {
    const styleMap = {};
    for (let i = FONT_SIZE_MINIMUM; i <= FONT_SIZE_MAXIMUM; i += FONT_SIZE_INCREASE) {
        styleMap[FONT_SIZE_PREFIX + i] = {
            fontSize: (i / 100.0) + "em",
        };
    }
    return styleMap;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildExportStyleMap() {
    const styleMap = buildStyleMap();
    const result = {};
    for (const key in styleMap) {
        if (key) {
            result[key] = { style: styleMap[key] };
        }
    }
    return result;
}
