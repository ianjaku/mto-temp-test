import React from "react";

/**
 * This function wraps part of a string in a <strong> tag, outputting a React node
 */
export function makeSubstringBold(text: string, search: string): React.ReactNode {
    const parts = text.split(new RegExp(`(${search})`, "g"));
    return parts.map((part, index) =>
        part === search ?
            (
                <strong key={index}>
                    {part}
                </strong>
            ) :
            (
                part
            )
    );
}