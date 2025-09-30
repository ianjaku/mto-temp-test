import * as React from "react";
import { ColorPalette, CustomColors } from "./colors";
import { ContentTitleAction, ContentTitleRow } from "../maintitle";
import {
    CustomTagStyle,
    Logo,
    ReaderBranding
} from "@binders/client/lib/clients/routingservice/v1/contract";
import {
    PreviewDocument,
    PreviewHomepage,
    PreviewLoading,
    PreviewLogin,
    brandingToCssVars
} from "./previews";
import { Account } from "@binders/client/lib/clients/accountservice/v1/contract";
import { CustomStyles } from "./custom-tags";
import { Fonts } from "./fonts";
import { Input } from "../../components/input";
import LogoUploader from "./logo-uploader";
import { browserHistory } from "react-router";
import { useAccountUrlToken } from "../../api/hooks";
import "./editor.styl";

const { useCallback, useEffect, useState } = React;

type StyleNameProps = {
    branding: ReaderBranding;
    update: (name: string) => void;
}

const StyleName: React.FC<StyleNameProps> = ({ branding, update }) => {
    return (
        <div className="form-input-row">
            <label htmlFor="styleName">Style Name</label>
            <Input id="styleName" className="bg-white" type="text" onChange={(e) => update(e.target.value)} value={branding.name} />
        </div>
    );
}

type BrandingEditorProps = {
    currentAccount: Account;
    currentBranding: ReaderBranding;
    onBrandCreate: (accountId: string, logo: File, branding: ReaderBranding) => void;
    onBrandUpdate: (accountId: string, logo: File, branding: ReaderBranding) => void;
}

const colorPattern = /^#[0-9A-Fa-f]{0,6}$/i;
const isValidColor = (color: string) => color.match(colorPattern);

const updateCustomTag = (br: ReaderBranding, index: number, value: Partial<CustomTagStyle>): ReaderBranding => ({
    ...br,
    stylusOverrideProps: {
        ...(br.stylusOverrideProps ?? {}),
        customTagsStyles: [
            ...(br?.stylusOverrideProps?.customTagsStyles?.slice(0, index) ?? []),
            { ...(br?.stylusOverrideProps?.customTagsStyles?.[index] ?? {}), ...value } as CustomTagStyle,
            ...(br?.stylusOverrideProps?.customTagsStyles?.slice(index + 1) ?? []),
        ],
    },
});

const updateColor = (br: ReaderBranding, colorName: keyof ReaderBranding["stylusOverrideProps"], colorValue: string): ReaderBranding =>
    isValidColor(colorValue) ?
        ({
            ...br,
            stylusOverrideProps: {
                ...(br.stylusOverrideProps ?? {}),
                [colorName]: colorValue,
            },
        }) :
        br;

const updateFont = (br: ReaderBranding, fontName: keyof ReaderBranding["stylusOverrideProps"], fontValue: string) => ({
    ...br,
    stylusOverrideProps: {
        ...(br.stylusOverrideProps ?? {}),
        [fontName]: fontValue,
    },
});

export const BrandingEditor: React.FC<BrandingEditorProps> = ({
    currentAccount,
    currentBranding,
    onBrandCreate,
    onBrandUpdate,
}) => {
    const [branding, setBranding] = useState<ReaderBranding>(currentBranding ?? {} as ReaderBranding);
    const { data: urlToken } = useAccountUrlToken(currentAccount?.id);

    useEffect(() => {
        setBranding(currentBranding ?? {} as ReaderBranding);
    }, [currentBranding, setBranding]);

    const onSave: React.MouseEventHandler<HTMLButtonElement> = useCallback((e) => {
        e.preventDefault();
        return currentBranding ?
            onBrandUpdate(currentAccount.id, null, branding) :
            onBrandCreate(currentAccount.id, null, branding);
    }, [branding, currentAccount, currentBranding, onBrandCreate, onBrandUpdate]);

    return (
        <div className="branding-editor">
            <form className="branding-editor__form">
                <div className="branding-editor__form-title">
                    <ContentTitleRow title={`Account Branding for ${currentAccount?.name}`}>
                        <ContentTitleAction icon="" label="Cancel" variant="outline" handler={() => browserHistory.push("/branding/edit")} />
                        <ContentTitleAction icon="save" label="Save" handler={onSave} />
                    </ContentTitleRow>
                </div>
                <StyleName branding={branding} update={name => setBranding(prev => ({ ...prev, name }))} />
                <aside className="branding-editor__form-options">
                    <div className="branding-editor__form-options-pane">
                        <div className="form-section">
                            <h3>Logo</h3>
                            <LogoUploader
                                logo={branding?.logo}
                                urlToken={urlToken}
                                onImageUpdate={(logo: Logo) => setBranding(br => ({ ...br, logo }))}
                                onFileReceived={(file: string) => setBranding(br => ({ ...br, logoImg: file }))}
                                onDelete={() => setBranding(br => ({ ...br, logo: null, logoImg: null }))}
                            />
                        </div>
                        <div className="form-section">
                            <h3>Fonts</h3>
                            <Fonts
                                branding={branding}
                                updateFont={(fontName, fontValue) => setBranding(prev => updateFont(prev, fontName, fontValue))}
                            />
                        </div>
                        <div className="form-section">
                            <h3>Styles</h3>
                            <CustomStyles
                                branding={branding}
                                updateStyle={(index, value) => setBranding(prev => updateCustomTag(prev, index, value))}
                            />
                        </div>
                    </div>
                    <div className="branding-editor__form-options-pane">
                        <div className="form-section">
                            <h3>Color Palette</h3>
                            <ColorPalette
                                branding={branding}
                                updateColor={(colorName, colorValue) => setBranding(prev => updateColor(prev, colorName, colorValue))}
                            />
                        </div>
                        <div className="form-section">
                            <h3>Custom Colors</h3>
                            <CustomColors
                                branding={branding}
                                updateColor={(colorName, colorValue) => setBranding(prev => updateColor(prev, colorName, colorValue))}
                            />
                        </div>
                    </div>
                </aside>
            </form>
            <div className="branding-editor__preview">
                <div className="branding-editor__preview-title">
                    <h3>Branding Preview</h3>
                </div>
                <div className="branding-editor__preview-content" style={brandingToCssVars(branding)}>
                    <PreviewHomepage branding={branding} urlToken={urlToken} />
                    <PreviewLogin />
                    <PreviewDocument />
                    <PreviewLoading />
                </div>
            </div>
        </div>
    );
}
