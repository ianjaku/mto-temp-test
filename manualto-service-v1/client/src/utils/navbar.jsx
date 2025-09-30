import * as React from "react";
import "./navbar.styl";

export class NavbarButton extends React.Component {

    render() {
        const className = "action-group " + (this.props.activeClass || "");
        return (
            <div className={className} onClick={this.props.onClick}>
                {this.props.icon} {!this.props.collapsed && this.props.title}
            </div>
        );
    }
}

export class NavbarSpacer extends React.Component {
    render() {
        return <div className="action-group-spacer">&nbsp;</div>;
    }
}
