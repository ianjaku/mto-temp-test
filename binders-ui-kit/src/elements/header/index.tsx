import * as React from "react";
import { Theme, createStyles, makeStyles } from "@material-ui/core/styles";
import Thumbnail, { FitBehaviour } from "../thumbnail";
import AppBar from "@material-ui/core/AppBar";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import Close from "../icons/Close";
import IconButton from "@material-ui/core/IconButton";
import Menu from "../icons/Menu";
import Toolbar from "@material-ui/core/Toolbar";
import colors from "../../variables";
import cx from "classnames";
import { navbarDrawerWidth } from "../navbar";
import "./header.styl";

const ICON_STYLE = { fontSize: 36, color: colors.grey900 };

type HeaderProps = {
    fixed?: boolean;
    headerImage: ClientThumbnail;
    isOpen?: boolean;
    onClick: () => void;
    tailElement?: React.ReactNode;
}

const Header = React.forwardRef<HTMLButtonElement, HeaderProps>((props, ref) => {
    const classes = useStyles();
    const { fixed, isOpen, onClick, headerImage, tailElement } = props;
    return (
        <AppBar
            className={cx(classes.appBar, "header", { "header--fixed": fixed })}
            position="fixed"
            variant="outlined"
        >
            <Toolbar className="header-toolbar" classes={{ root: classes.toolbar }}>
                <IconButton
                    aria-label="open drawer"
                    edge="start"
                    onClick={onClick}
                    className={classes.menuButton}
                    ref={ref}
                >
                    {isOpen ? Close(ICON_STYLE) : Menu(ICON_STYLE, colors.grey900)}
                </IconButton>
                {headerImage && (
                    <a className="header-toolbar-logo" href="/">
                        <Thumbnail
                            src={headerImage.buildRenderUrl({ requestedFormatNames: ["thumbnail"] })}
                            fitBehaviour={headerImage.fitBehaviour === "crop" ? FitBehaviour.CROP : FitBehaviour.FIT}
                            bgColor={headerImage.bgColor}
                            rotation={parseInt(headerImage.rotation, 10)}
                        />
                    </a>
                )}
                {tailElement && (
                    <div className="header-toolbar-tailElement">
                        {tailElement}
                    </div>
                )}
            </Toolbar>
        </AppBar>
    );
});

const useStyles = makeStyles((theme: Theme) => createStyles({
    appBar: {
        backgroundColor: colors.whiteColor,
        border: "0px",
        borderBottom: `1px solid ${colors.middleGreyColor}`,
        [theme.breakpoints.up("sm")]: {
            marginLeft: navbarDrawerWidth,
            width: `calc(100% - ${navbarDrawerWidth}px)`,
        },
        maxHeight: "50px",

    },
    menuButton: {
        marginRight: theme.spacing(2),
        padding: "6px 0px 6px 6px",
        [theme.breakpoints.up("sm")]: {
            display: "none",
        },
    },
    toolbar: {
        minHeight: "50px",
        [theme.breakpoints.down("md")]: {
            minHeight: "0px",
        },
    },
}));

export default Header;