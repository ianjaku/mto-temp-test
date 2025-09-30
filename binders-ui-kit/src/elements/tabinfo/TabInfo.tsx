import * as React from "react";
import { FC, useEffect } from "react";
import { isPlaceholderVisual } from "@binders/client/lib/clients/imageservice/v1/visuals";

function setDocumentTitle(title: string) {
    const oldTitle = document.title;
    document.title = title;

    return () => {
        document.title = oldTitle;
    }
}

function setFavicon(url: string) {
    const faviconEls = document.head.querySelectorAll("link[rel~='icon']");
    if (faviconEls == null) return () => null;

    const oldValues = [];
    faviconEls.forEach((faviconEl: Element) => {
        if (!(faviconEl instanceof HTMLLinkElement)) return;
        oldValues.push({ el: faviconEl, oldHref: faviconEl.href });
        faviconEl.href = url;
    });

    return () => {
        oldValues.forEach(({el, oldHref}) => {
            el.href = oldHref;
        })
    };
}

export const TabInfo: FC<{ title?: string; faviconUrl?: string }> = ({
    children,
    title,
    faviconUrl
}) => {

    useEffect(() => {
        const destructors = [];

        if (title != null) {
            destructors.push(setDocumentTitle(title + " - Manual.to"));
        }

        if (faviconUrl != null && !isPlaceholderVisual(faviconUrl)) {
            destructors.push(setFavicon(faviconUrl));
        }

        return () => {
            destructors.forEach(d => d());
        }
    }, [title, faviconUrl])

    return <>{children}</>;
}
