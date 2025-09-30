import * as React from "react";
import { UserLinkerContextProvider, UserLinkerProps } from "./userLinkerContext";
import UserLinkerComponent from "./UserLinkerComponent";

const UserLinker: React.FC<UserLinkerProps> = (props) => {
    return (
        <UserLinkerContextProvider props={props}>
            <UserLinkerComponent />
        </UserLinkerContextProvider>
    )
}

export default UserLinker;
