import * as React from "react";
import { Input } from "../../components/input";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { useDebouncedValue } from "@binders/client/lib/react/hooks/useDebouncedValue";

export type FontRowProps = {
    label: string;
    placeholder: string;
    fontName: string;
    fontValue: string;
    updateField: (value: string) => void;
}

export type FontsProps = {
    branding: ReaderBranding;
    updateFont: (fontName: keyof ReaderBranding["stylusOverrideProps"], fontValue: string) => void;
}

const FontRow: React.FC<FontRowProps> = ({ label, placeholder, fontName, fontValue, updateField }) => {
    return (
        <div className="form-input-row">
            <label htmlFor={fontName}>{label}</label>
            <Input
                type="text"
                className="bg-white"
                id={fontName}
                placeholder={placeholder}
                onBlur={e => updateField(e.target.value)}
                onChange={e => updateField(e.target.value)}
                value={fontValue}
            />
        </div>
    );
}

function customFontsAvailable(branding: ReaderBranding, font: string) {
    if (!branding || !branding.customFonts) {
        return false;
    }
    return !!branding.customFonts.find(cf => cf.name === font)
}

async function hasValidFonts(branding: ReaderBranding): Promise<boolean> {
    const systemFont = branding?.stylusOverrideProps?.systemFont;
    const titleFont = branding?.stylusOverrideProps?.titleFont;
    const userFont = branding?.stylusOverrideProps?.userFont;
    const fonts = [systemFont, titleFont, userFont];
    const touchedFonts = fonts.filter(font => font != null && font !== "");
    if (touchedFonts.length === 0) {
        return true;
    }
    const findGoogleFontsUrl = (font: string) => `https://fonts.googleapis.com/css?family=${font}:400,700`;
    for (let i = 0; i < touchedFonts.length; i++) {
        const font = touchedFonts[i];
        if (customFontsAvailable(branding, font)) {
            continue;
        } else {
            try {
                const resp = await fetch(findGoogleFontsUrl(font));
                if (!resp.ok) {
                    return false;
                }
            } catch (ex) {
                return false;
            }
        }
    }
    return true;
}

export const Fonts: React.FC<FontsProps> = ({ branding, updateFont }) => {
    const [hasFontError, setHasFontError] = React.useState(false);
    const debouncedBranding = useDebouncedValue(branding, 500);

    const checkFonts = React.useCallback(async (branding: ReaderBranding) => {
        const validFonts = await hasValidFonts(branding);
        setHasFontError(validFonts == null ? false : !validFonts);
    }, [setHasFontError]);

    React.useEffect(() => {
        checkFonts(debouncedBranding);
    }, [debouncedBranding, checkFonts]);

    return (
        <>
            <FontRow
                label="System font"
                placeholder="Montserrat"
                fontName="systemFont"
                fontValue={branding?.stylusOverrideProps?.systemFont}
                updateField={value => updateFont("systemFont", value)}
            />
            <FontRow
                label="User font"
                placeholder="Open Sans"
                fontName="userFont"
                fontValue={branding?.stylusOverrideProps?.userFont}
                updateField={value => updateFont("userFont", value)}
            />
            <FontRow
                label="Title font"
                placeholder="Rokkitt"
                fontName="titleFont"
                fontValue={branding?.stylusOverrideProps?.titleFont}
                updateField={value => updateFont("titleFont", value)}
            />
            {hasFontError && (
                <div className="font-row font-error">
                    <p>Can"t save. Some of the picked fonts are neither available among custom fonts nor google fonts</p>
                </div>
            )}
        </>
    );
}

