/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";

interface IWindowWithIntercomProps extends Window {
    Intercom?: any;
    intercomSettings?: any;
    attachEvent?: any;
}

interface IIntercom {
    q?: any;
    c?: any;
}

export interface IIntercomUserData {
    email: string;
    user_id: string;
    user_hash?: string;
    name: string;
}

const toIntercomUserData = (user: User) => ({
    email: user.login,
    name: user.displayName,
    user_id: user.id,
} as IIntercomUserData);

export interface IIntercomProps {
    user: User;
    children: any;
    appId: string;
    userHash: string;
}

export interface IIntercomState {
    userId: string;
    userData: IIntercomUserData;
}

class Intercom extends React.Component<IIntercomProps, IIntercomState> {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    constructor(props) {
        super(props);
        this.initIntercom = this.initIntercom.bind(this);
        this.setupIntercom = this.setupIntercom.bind(this);
        this.state = {
            userData: undefined,
            userId: undefined,
        };
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public async componentDidUpdate() {
        const { userId } = this.state;
        const { user } = this.props;
        if (user && userId !== user.id) {
            const setupIntercom = this.setupIntercom.bind(this);
            this.setState({
                userData: toIntercomUserData(user),
                userId: user.id,
            }, setupIntercom);
        }
    }

    public render(): JSX.Element {
        return this.props.children;
    }

    private setupIntercom() {
        const { userData } = this.state;
        if (!userData) {
            return;
        }
        const icWindow = window as IWindowWithIntercomProps;
        if (!icWindow.Intercom) {
            this.initIntercom();
        } else {
            icWindow.Intercom("reattach_activator");
            icWindow.Intercom("update", icWindow.intercomSettings);
        }
    }

    private initIntercom() {
        const { appId, userHash } = this.props;
        const { userData } = this.state;
        const icWindow = window as IWindowWithIntercomProps;

        const intercomSettings = {
            app_id: appId,
            user_hash: userHash,
            z_index: 1100,
            ...userData,
        };

        if (userData.email.startsWith("seleniumdroid")) {
            intercomSettings.email = "seleniumdroid@manual.to";
            delete intercomSettings.user_id;
            delete intercomSettings.user_hash;
        }

        // eslint-disable-next-line prefer-rest-params
        const intercom = (function() { intercom.c(arguments); }) as IIntercom;
        intercom.q = [] as any[];
        intercom.c = (args) => { intercom.q.push(args); };

        icWindow.Intercom = intercom;
        const script = document.createElement("script");
        script.async = true;
        script.src = `https://widget.intercom.io/widget/${appId}`;
        document.head.appendChild(script);
        icWindow.intercomSettings = intercomSettings;
        icWindow.Intercom("boot", intercomSettings);
    }
}

export default Intercom;
