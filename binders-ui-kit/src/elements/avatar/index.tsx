import * as React from "react";
import Avatar from "@material-ui/core/Avatar";

export interface IAvatarProps {
    image: string;
    size?: number;
    // eslint-disable-next-line @typescript-eslint/ban-types
    style?: object;
}

const avatar: React.StatelessComponent<IAvatarProps> = props => (
    <Avatar
        src={props.image}
        style={{ ...props.style, width: `${props.size}px`, height: `${props.size}px` }}
    />
);

export default avatar;





