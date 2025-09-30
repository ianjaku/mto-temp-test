import * as React from "react";
import { DEFAULT_BRANDING } from "./types";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { getUrlFromLogo } from "./logo-uploader";
import "./previews.styl";

export function brandingToCssVars(branding: ReaderBranding): React.CSSProperties {
    return {
        "--clr-primary": branding?.stylusOverrideProps?.bgDark ?? DEFAULT_BRANDING.stylusOverrideProps.bgDark,
        "--clr-bg": branding?.stylusOverrideProps?.bgMedium ?? DEFAULT_BRANDING.stylusOverrideProps.bgMedium,
        "--clr-text": branding?.stylusOverrideProps?.fgDark ?? DEFAULT_BRANDING.stylusOverrideProps.fgDark,
        "--clr-header-bg": branding?.stylusOverrideProps?.headerBgColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerBgColor,
        "--clr-header-text": branding?.stylusOverrideProps?.headerFontColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerFontColor,
    } as React.CSSProperties;
}

export type BrandingProps = {
    branding: ReaderBranding;
    urlToken?: string;
}

const PreviewCard: React.FC<{ title: string }> = ({ title }) => (
    <div className="preview-card">
        <div className="preview-card-img" />
        <div className="preview-card-title"><span>{title}</span></div>
    </div>
)

export const PreviewHomepage: React.FC<BrandingProps> = ({ branding, urlToken }) => {
    return (
        <div className="preview preview-homepage">
            <div className="preview-navbar">
                <div className="preview-logo"><img src={getUrlFromLogo(branding?.logo, urlToken)} /></div>
                <div className="preview-search"></div>
                <div className="preview-menu">Sign in</div>
            </div>
            <div className="preview-body">
                <PreviewCard title="Lorem" />
                <PreviewCard title="Ipsum" />
                <PreviewCard title="Dolor" />
                <PreviewCard title="Sit" />
                <PreviewCard title="Amet" />
                <PreviewCard title="Consectetur" />
            </div>
        </div>
    );
}

export const PreviewDocument: React.FC = () => {
    return (
        <div className="preview preview-document">
            <div className="preview-popup">
                <span>This document has a newer version </span>&nbsp;<span style={{ color: "white" }}>here</span>
            </div>
            <div className="preview-visual" />
            <div className="preview-chunk">
                <h4>Lorem ipsum</h4>
                <span>Dolor sit amet, consectetur adipiscing elit</span>
            </div>
        </div>
    )
}

export const PreviewLogin: React.FC = () => {
    return (
        <div className="preview preview-login">
            <div className="preview-header">
                <span>demo</span><span>.manual.to</span>
            </div>
            <div className="preview-input"></div>
            <div className="preview-input"></div>
            <div className="preview-button">LOGIN</div>
        </div>
    );
}

export const PreviewLoading: React.FC = () => {
    return (
        <div className="preview preview-loading">
            <div className="loader"></div>
            <span>Loading ...</span>
        </div>
    )
}
