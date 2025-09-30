import * as React from "react";
import { INavbarMenuItem, NavbarMenuItemType } from "./index";
import AVLibraryAdd from "@material-ui/icons/Add";
import AVLibraryBooks from "@material-ui/icons/LibraryBooks";
import ActionDashboard from "@material-ui/icons/Dashboard";
import ChromeReaderModeIcon from "@material-ui/icons/ChromeReaderMode";
import Delete from "@material-ui/icons/Delete";
import Help from "@material-ui/icons/Help";
import Home from "@material-ui/icons/Home";
import MapsMyLocation from "@material-ui/icons/MyLocation";
import { NavLink } from "react-router-dom";
import NetworkCheck from "@material-ui/icons/NetworkCheck";
import PieChart from "@material-ui/icons/PieChart";
import Settings from "@material-ui/icons/Settings";
import SocialGroup from "@material-ui/icons/Group";
import Timer from "@material-ui/icons/Timer";
import cx from "classnames";
import "./navbar.styl";

export interface INavbarMenuItemElementProps {
    item: INavbarMenuItem;
    active: boolean;
    onActivate: (type: NavbarMenuItemType) => void;
}

function getMuiIcon(name: NavbarMenuItemType) {
    switch (name) {
        case NavbarMenuItemType.dashboard:
            return <ActionDashboard />;
        case NavbarMenuItemType.create:
            return <AVLibraryAdd />;
        case NavbarMenuItemType.myLibrary:
            return <AVLibraryBooks />;
        case NavbarMenuItemType.analytics:
            return <PieChart />;
        case NavbarMenuItemType.users:
            return <SocialGroup />;
        case NavbarMenuItemType.pieChart:
            return <PieChart />;
        case NavbarMenuItemType.networkCheck:
            return <NetworkCheck />;
        case NavbarMenuItemType.advanced:
            return <MapsMyLocation />;
        case NavbarMenuItemType.trash:
            return <Delete />
        case NavbarMenuItemType.performance:
            return <Timer />
        case NavbarMenuItemType.reader:
            return <ChromeReaderModeIcon />
        case NavbarMenuItemType.home:
            return <Home />
        case NavbarMenuItemType.settings:
            return <Settings />
        case NavbarMenuItemType.help:
            return <Help />;
        default:
            return undefined;
    }
}

const LocalNavLink: React.FC<React.PropsWithChildren<{ item: INavbarMenuItem }>> = ({ children, item }) => {
    return (
        <NavLink exact={item.exact} to={item.link} className="navbar-main-navigation-list-item-link" activeClassName="is-active">
            {children}
        </NavLink>
    )
}

const ExternalNavLink: React.FC<React.PropsWithChildren<{ item: INavbarMenuItem }>> = ({ children, item }) => {
    return (
        <a href={item.link} target="_blank" title={item.label} className="navbar-main-navigation-list-item-link">
            {children}
        </a>
    );
}

export default function INavbarMenuItemElement(props: INavbarMenuItemElementProps): React.ReactElement {
    const { active, item, onActivate } = props;
    const icon = getMuiIcon(item.type);

    const LinkRenderer = item.type === NavbarMenuItemType.reader ? ExternalNavLink : LocalNavLink;
    return (
        <li className={cx("navbar-main-navigation-list-item", { active })} onClick={() => onActivate(item.type)} >
            <LinkRenderer item={item}>
                {React.cloneElement(icon, { className: "navbar-main-navigation-list-item-icon" })}
                <label className="navbar-main-navigation-list-item-label">
                    {item.label}
                </label>
            </LinkRenderer>
        </li>
    );
}

export const NavbarCreateButton = React.forwardRef<HTMLButtonElement, { isDisabled?: boolean; label: string; onClick: () => void; }>(
    ({ isDisabled, label, onClick }, ref) => (
        <button ref={ref} className={cx(
            "navbar-create-button",
            isDisabled ? "navbar-create-button--disabled" : null
        )} onClick={onClick}>
            <AVLibraryAdd />
            <span className="navbar-create-button-label">
                {label}
            </span>
        </button>
    ));
