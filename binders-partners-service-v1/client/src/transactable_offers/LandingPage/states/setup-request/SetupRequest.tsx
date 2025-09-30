import * as React from "react";
import { BoxFooter } from "../../../../components/generic-box/box-footer/BoxFooter";
import { BoxHeader } from "../../../../components/generic-box/box-header/BoxHeader";
import { GenericBox } from "../../../../components/generic-box/GenericBox";
import "./setup-request.styl";

export const SetupRequest: React.FC = () => {
    return (
        <GenericBox>
            <BoxHeader>Thank you,</BoxHeader>
            <p className="setup-request-text">
                We'll contact you within 48 hours
                when your account has been provisioned.
            </p>
            <BoxFooter />
        </GenericBox>
    );
}
