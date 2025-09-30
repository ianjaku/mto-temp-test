import { BaseStyleProps } from "./base";

export interface ReaderCssProps extends BaseStyleProps {
    bgLight: string;
    bgMedium: string;
    bgDark: string;
    fgLightest: string;
    fgLight: string;
    fgMedium: string;
    fgDark: string;
    fgColor1: string;
    menuBgActive: string;
    fgTooltip: string;
    borderColor1: string;
    btnPrimary: string;
    btnSecondary: string;
    headerFontColor: string;
    headerBgColor?: string;
    customTagsStyles: Array<{tag: string, style: string}>;
    systemFont: string;
    systemFont2: string;
    userFont: string;
    titleFont: string;
}

export const defaultReaderProps: ReaderCssProps = {
    bgLight: "#ffffff",
    bgMedium: "#fbf5ed",
    bgDark: "#fac04e",
    fgLightest: "#ffffff",
    fgLight: "#c2bbb1",
    fgMedium: "#5e5b56",
    fgDark: "#000000",
    fgColor1: "#fac04e",
    menuBgActive: "#5a554c",
    fgTooltip: "#5a554c",
    borderColor1: "#bbbbbb",
    btnPrimary: "#fac04e",
    btnSecondary: "#c2bbb1",
    headerFontColor: "#ffffff",
    headerBgColor: "#fac04e",
    customTagsStyles: [],
    systemFont: "Rubik",
    systemFont2: "Rubik",
    userFont: "Open Sans",
    titleFont: "Rokkitt",
};