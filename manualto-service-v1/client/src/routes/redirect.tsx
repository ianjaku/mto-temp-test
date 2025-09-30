import * as React from "react";
import { Redirect, RedirectProps, useLocation } from "react-router-dom";

/**
 * `<RedirectWithSearch>` works exactly like React-Router’s `<Redirect>`,
 * but automatically appends (or preserves) the current URL’s search string.
 */
export const RedirectWithSearch = ({ to, push, ...rest }: RedirectProps) => {
    const { search } = useLocation();

    const target: RedirectProps["to"] = typeof to === "string" ?
        `${to}${search}` :
        { ...to, search: to.search ?? search };

    return (
        <Redirect
            to={target}
            push={push}
            {...rest}
        />
    );
};

export default RedirectWithSearch;
