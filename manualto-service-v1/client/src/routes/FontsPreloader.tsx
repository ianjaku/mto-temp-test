import React, { useMemo } from "react";

interface Props {
    children: React.ReactElement;
}

const WEIGHTS = [400, 700];

/*
    Note: This is a hack to preload all necessary fonts on first page render.
    The issue is that the google font links are css files, with the woff2 links inside them,
    so attributes like rel="preload" etc on these links don't preload the fonts.
    At the time of this writing there doesn't seem to be a way to fix it cleanly
*/

const FontsPreloader: React.FC<Props> = ({ children }) => {

    const fontNames = useMemo(() => {
        const allFontLinksOnPage = document.querySelectorAll("link[rel=stylesheet][type='text/css'][data-font-preload]");
        const urls = Array.from(allFontLinksOnPage).map((link) => link.getAttribute("href"));
        return [...new Set(urls.map((url) => url.split("googlefonts/").at(1)).filter(u => !!u)).values()];
    }, []);

    const combinations = useMemo(() => {
        return fontNames.flatMap((fontName) => WEIGHTS.map((weight) => `${fontName}:${weight}`));
    }, [fontNames]);

    return (
        <>
            {children}
            <div
                id="fonts-preloader"
                style={{
                    position: "absolute",
                    visibility: "hidden",
                }}
            >
                {combinations.map((combination) => (
                    <span
                        key={combination}
                        style={{
                            fontFamily: combination.split(":")[0],
                            fontWeight: combination.split(":")[1],
                        }}
                    >.</span>
                ))}

            </div>
        </>
    )
}

export default FontsPreloader;
