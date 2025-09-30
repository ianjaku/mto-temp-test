import * as React from "react";
import { Theme, createStyles, makeStyles } from "@material-ui/core/styles";
import Thumbnail, { FitBehaviour } from "../thumbnail";
import { useRibbonsBottomHeight, useRibbonsTopHeight } from "../../compounds/ribbons/hooks";
import ClientThumbnail from "@binders/client/lib/clients/repositoryservice/v3/Thumbnail";
import Hidden from "@material-ui/core/Hidden";
import MaterialDrawer from "@material-ui/core/Drawer";
import NavbarMenuItemElement from "./NavbarMenuItemElement";
import classnames from "classnames";
import "./navbar.styl";

export interface INavbarDrawerProps {
    className: string;
    elevation?: number;
    isOpen: boolean;
    onClose: () => void;
}

export const navbarDrawerWidth = 240;

const useStyles = makeStyles((theme: Theme) => createStyles({
    drawer: {
        [theme.breakpoints.up("sm")]: {
            flexShrink: 0,
            width: navbarDrawerWidth,
        },
    },
    drawerPaper: {
        width: navbarDrawerWidth,
    },
}));

export const NavbarDrawer = React.forwardRef<HTMLElement, React.PropsWithChildren<INavbarDrawerProps>>((props, ref) => {
    const classes = useStyles();
    const { className, elevation: propsElevation, isOpen, onClose } = props;
    const elevation = propsElevation || 8;

    return (
        <nav className={classes.drawer} ref={ref}>
            <Hidden smUp={true} implementation="css">
                <MaterialDrawer
                    anchor="left"
                    classes={{ root: className, paper: classes.drawerPaper }}
                    ModalProps={{ keepMounted: true }}
                    onClose={onClose}
                    open={isOpen}
                    variant="persistent"
                    PaperProps={{ elevation }}
                >
                    {props.children}
                </MaterialDrawer>
            </Hidden>
            <Hidden xsDown={true} implementation="css">
                <MaterialDrawer
                    open={true}
                    variant="permanent"
                    classes={{ root: className, paper: classes.drawerPaper }}
                    PaperProps={{ elevation }}
                >
                    {props.children}
                </MaterialDrawer>
            </Hidden>
        </nav>
    );
});

export interface INavbarMenuItem {
    label: string;
    link?: string;
    exact?: boolean;
    type: NavbarMenuItemType;
    element?: React.ReactElement;
}

export enum NavbarMenuItemType {
    advanced,
    analytics,
    create,
    dashboard,
    home,
    help,
    myLibrary,
    networkCheck,
    performance,
    pieChart,
    reader,
    settings,
    trash,
    users,
}

const Navbar: React.FC<{
    activateMenuItem?: (type: NavbarMenuItemType) => void;
    bottomItems: INavbarMenuItem[];
    headerElement?: React.ReactElement;
    headerImage?: ClientThumbnail;
    helpAccountComponent?: React.ReactElement;
    isMobileDrawerOpen?: boolean;
    items: INavbarMenuItem[];
    preselectedType?: NavbarMenuItemType;
    setIsMobileDrawerOpen?: (value: boolean) => void;
}> = ({
    activateMenuItem,
    bottomItems,
    children,
    headerElement,
    headerImage,
    helpAccountComponent,
    isMobileDrawerOpen,
    items,
    preselectedType,
    setIsMobileDrawerOpen,
}) => {
    const [activeMenuItemType, setActiveMenuItemType] = React.useState(preselectedType);
    const ribbonsTopHeight = useRibbonsTopHeight();
    const ribbonsBottomHeight = useRibbonsBottomHeight();

    const onMenuItemActivation = React.useCallback((type: NavbarMenuItemType) => {
        activateMenuItem?.(type);
        setActiveMenuItemType(type);
    }, [activateMenuItem]);

    const menuItemsWithoutCreate = React.useMemo(() => items.filter(i => i.type !== NavbarMenuItemType.create), [items]);
    const menuItemCreate = React.useMemo(() => items.find(i => i.type === NavbarMenuItemType.create), [items]);

    return (
        <div
            className={classnames("navbar", "navbar-left")}
            style={{
                paddingTop: `${ribbonsTopHeight}px`,
                paddingBottom: `${ribbonsBottomHeight}px`,
            }}
        >
            <div className="navbar-logo">
                <a href="/">
                    {headerImage && (
                        <Thumbnail
                            src={headerImage.buildRenderUrl({ requestedFormatNames: ["medium"] })}
                            fitBehaviour={headerImage.fitBehaviour === "crop" ? FitBehaviour.CROP : FitBehaviour.FIT}
                            bgColor={headerImage.bgColor}
                            imgClassName="navbar-logo-image"
                            width={80}
                            rotation={parseInt(headerImage.rotation, 10)}
                        />
                    )}
                </a>
            </div>
            <div className="navbar-main">
                <div className="navbar-main-navigation">
                    <ul className="navbar-main-navigation-list">
                        {headerElement}
                        {menuItemCreate?.element ?? null}
                        {menuItemsWithoutCreate.map(item => (
                            <NavbarMenuItemElement
                                key={item.type.toString()}
                                item={item}
                                active={item.type === activeMenuItemType}
                                onActivate={onMenuItemActivation}
                            />
                        ))}
                    </ul>
                </div>
                <div className="navbar-main-bottomsection">
                    <div className="navbar-main-navigation-list">
                        {bottomItems.map(item => (
                            <NavbarMenuItemElement
                                key={item.type.toString()}
                                item={item}
                                active={item.type === activeMenuItemType}
                                onActivate={onMenuItemActivation}
                            />
                        ))}
                        {helpAccountComponent}
                        {children}
                    </div>
                </div>
            </div>
            {isMobileDrawerOpen && <div className="navbar-outside-click" onClick={() => setIsMobileDrawerOpen?.(false)} />}
        </div>
    );
}

export default Navbar;
