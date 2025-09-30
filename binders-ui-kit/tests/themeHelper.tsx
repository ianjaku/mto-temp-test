import * as React from "react";
import { ThemeProvider } from "@material-ui/core/styles";
import theme from "../src/style/theme";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export default function wrapWithTheme(node) {
    return (
        <ThemeProvider theme={theme}>{node}</ThemeProvider>
    );
}