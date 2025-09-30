import { useState } from "react";

const AVAILABLE_TAGS = ["editor_link", "reader_link", "title", "name"];

export const useNotificationBodyValidator = (): {
    error: string | null;
    validate: (body: string) => boolean,
    clearError: () => void
} => {
    const [error, setError] = useState<null | string>(null);
    
    return {
        validate(body: string): boolean {
            setError(null);
            const unknownTags = findUnknownTags(body);
            if (unknownTags.length === 0) return true;
            const errorTag = unknownTags[0];
            const mostSimilar = findMostSimilarString(errorTag.slice(2, -2), AVAILABLE_TAGS);
            setError(`Unknown tag: ${errorTag}. Did you mean [[${mostSimilar}]]?`);
            return false;
        },
        error,
        clearError: () => setError(null)
    }
}

const findUnknownTags = (body: string): string[] => {
    const tags = body.match(/\[\[[^\][]+\]\]/g); // Match anything between two brackets
    if (tags == null) return [];
    return tags.filter(tag => {
        const tagText = tag.slice(2, -2);
        return !AVAILABLE_TAGS.includes(tagText);
    });
}

const levenshteinDistance = (str1: string, str2: string) => {
    if (!str1.length) return str2.length;
    if (!str2.length) return str1.length;
    const arr = [];
    for (let i = 0; i <= str2.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= str1.length; j++) {
            if (i === 0) {
                arr[i][j] = j;
            } else {
                arr[i][j] = Math.min(
                    arr[i - 1][j] + 1,
                    arr[i][j - 1] + 1,
                    arr[i - 1][j - 1] + (str1[j - 1] === str2[i - 1] ? 0 : 1)
                );
            }
        }
    }
    return arr[str2.length][str1.length];
};

// Higher means more differences
const findDifferencessInStrings = (str1: string, str2: string): number => {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
        
    if (str1 === str2) return 0;
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str2.length;

    if (str1.includes(str2)) return 1;
    if (str2.includes(str1)) return 1;

    return levenshteinDistance(str1, str2);
}

const findMostSimilarString = (testStr: string, available: string[]) => {
    const mostSimilar = available.reduce<{ diff: number, value: string } | null>(
        (res, str) => {
            const diff = findDifferencessInStrings(testStr, str);
            if (res == null) return { diff, value: str };
            if (res.diff > diff) return { diff, value: str };
            return res;
        },
        null
    );
    return mostSimilar.value;
}
