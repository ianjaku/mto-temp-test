import colors from "../variables";
import { createTheme } from "@material-ui/core/styles";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default (accentColor = colors.accentColor) => createTheme({
    palette: {
        error: { main: colors.colorError },
        info: { main: colors.colorInfo },
        primary: {
            main: window?.bindersBranding?.stylusOverrideProps?.bgDark ?? accentColor,
        },
        success: { main: colors.colorOk },
        // primary1Color: colors.accentColor,
        // textColor: colors.baseColor,
        // accentColor: colors.accentColor,
        // middleGreyColor: colors.middleGreyColor,
        // baseColor: colors.baseColor,
        // primary2Color: colors.accentColor,
        // pickerHeaderColor: colors.accentColor,
    },
    typography: {
        fontFamily: "Rubik, sans-serif",
    },
});

