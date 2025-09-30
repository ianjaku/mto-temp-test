import * as React from "react";
import FontFaceObserver from "fontfaceobserver";
import { ThemeProvider } from "@material-ui/core/styles";
import theme from "./style/theme";
import "@binders/client/lib/react/i18n";

interface IThemeProps {
    accentColor?: string;
}
interface IThemeState {
    iconsFontLoaded: boolean;
}

export const FontLoadContext = React.createContext({ iconsLoaded: false });



class Theme extends React.Component<IThemeProps, IThemeState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.updateFontLoaded = this.updateFontLoaded.bind(this);
        this.state = {
            iconsFontLoaded: false,
        };

    }

    public componentDidMount(): void {
        const font = new FontFaceObserver("Material Icons");
        font.load().then(this.updateFontLoaded).catch(this.updateFontLoaded);
    }

    public render(): JSX.Element {
        const { children } = this.props;
        const { iconsFontLoaded } = this.state;
        return (
            <FontLoadContext.Provider value={{ iconsLoaded: iconsFontLoaded }}>
                <ThemeProvider theme={theme()}>
                    {children}
                </ThemeProvider>
            </FontLoadContext.Provider>
        );
    }

    private updateFontLoaded() {
        this.setState({ iconsFontLoaded: true });
    }

}

export default Theme;
