import * as React from "react";
import { SSOProvider, resolveSSOProviderName } from "@binders/client/lib/clients/accountservice/v1/contract";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import "./SSOProviderPicker.styl";

const SSOProviderLabel: React.FC<{ provider: SSOProvider }> = ({ provider }) => {
    const logoPath = provider === SSOProvider.OKTA ? "/assets/okta-logo.svg" : "/assets/entra-logo.svg";
    return (
        <div className="sso-provider-label">
            <img className="sso-provider-label-logo" src={logoPath}  alt="sso-provider-logo"/>
            {resolveSSOProviderName(provider)}
        </div>
    );
}

export const SSOProviderPicker: React.FC<{
    isSaving: boolean,
    provider: SSOProvider,
    setProvider: (p: SSOProvider) => void
}> = ({ isSaving, provider, setProvider }) => {
    return <div className="sso-provider-picker">
        <RadioButtonGroup value={provider ?? SSOProvider.ENTRA_ID}>
            {Object.values(SSOProvider).map(providerChoice => (
                <RadioButton
                    key={`sso-provider-radio-${providerChoice.toLowerCase()}`}
                    disabled={isSaving}
                    value={providerChoice}
                    label={<SSOProviderLabel provider={providerChoice}/>}
                    onChange={() => setProvider(providerChoice)}
                    className="sso-provider-radio"
                />
            ))}
        </RadioButtonGroup>
    </div>
}