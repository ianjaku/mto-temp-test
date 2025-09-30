import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";

export type BrandingUpdater = (updater: (b: ReaderBranding) => ReaderBranding) => void;

export const DEFAULT_BRANDING: ReaderBranding = {
    stylusOverrideProps: {
        systemFont: "Montserrat",
        titleFont: "Rokkitt",
        userFont: "Open Sans",
        // primary color
        bgDark: "#FAC04E",
        // background color
        bgMedium: "#FBF5ED",
        // foreground color
        fgDark: "#000000",
        // header background color
        headerBgColor: "#FAC04E",
        // header foreground color
        headerFontColor: "#FFFFFF",
    }
}
