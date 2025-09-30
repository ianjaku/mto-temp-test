import * as React from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../../components/tooltip";
import { DEFAULT_BRANDING } from "./types";
import FontAwesome from "react-fontawesome"
import { Input } from "../../components/input";
import { ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";

type Color = [number, number, number];
type Contrast = Record<keyof typeof WCAG_THRESHOLDS, boolean> & { contrast: number };

const RED = 0.2126;
const GREEN = 0.7152;
const BLUE = 0.0722;
const GAMMA = 2.4;
const WCAG_THRESHOLDS = {
    wcag_aa_normal: 4.5,
    wcag_aa_large: 3,
    wcag_aaa_normal: 7,
    wcag_aaa_large: 4.5,
};

function calculateLuminance(color: Color): number {
    const [r, g, b] = color;
    const a = [r, g, b].map((v) => {
        const normalized = v /= 255;
        return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, GAMMA);
    });
    return a[0] * RED + a[1] * GREEN + a[2] * BLUE;
}

function calculateContrast(rgb1: Color, rgb2: Color): number {
    if (!rgb1 || !rgb2) {
        return 0;
    }
    const lum1 = calculateLuminance(rgb1);
    const lum2 = calculateLuminance(rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

function expandShorthandColor(hex: string): string {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const isShorthand = shorthandRegex.test(hex);
    return isShorthand ? hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b) : hex;
}

function hexToRgb(hex: string): Color | null {
    const expandedHex = expandShorthandColor(hex);
    const validHex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
    const result = validHex.exec(expandedHex);
    if (!result) {
        return null;
    }
    return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
    ];
}

function checkContrast(hex1: string, hex2: string): Contrast {
    const contrast = calculateContrast(hexToRgb(hex1), hexToRgb(hex2));
    return {
        contrast,
        wcag_aa_normal: contrast > WCAG_THRESHOLDS.wcag_aa_normal,
        wcag_aa_large: contrast > WCAG_THRESHOLDS.wcag_aa_large,
        wcag_aaa_normal: contrast > WCAG_THRESHOLDS.wcag_aaa_normal,
        wcag_aaa_large: contrast > WCAG_THRESHOLDS.wcag_aaa_large,
    };
}

function validateColors(branding: ReaderBranding): boolean {
    return [
        branding?.stylusOverrideProps?.bgDark ?? DEFAULT_BRANDING.stylusOverrideProps.bgDark,
        branding?.stylusOverrideProps?.bgMedium ?? DEFAULT_BRANDING.stylusOverrideProps.bgMedium,
        branding?.stylusOverrideProps?.fgDark ?? DEFAULT_BRANDING.stylusOverrideProps.fgDark,
        branding?.stylusOverrideProps?.headerFontColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerFontColor,
        branding?.stylusOverrideProps?.headerBgColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerBgColor,
    ].reduce((res, item) => res && !!hexToRgb(item), true);
}

export type ColorRowProps = {
    label: string;
    placeholder: string;
    colorName: string;
    colorValue: string;
    updateField: (value: string) => void;
}

export const ColorRow: React.FC<ColorRowProps> = ({ label, placeholder, colorName, colorValue, updateField }) => {
    return (
        <div className="color-row">
            <label htmlFor={colorName} className="color-preview" style={{ backgroundColor: colorValue ?? placeholder }} />
            <div className="form-input-row">
                <label htmlFor={colorName}>{label}</label>
                <Input
                    id={colorName}
                    className="bg-white"
                    type="text"
                    placeholder={placeholder}
                    onBlur={e => updateField(e.target.value)}
                    onChange={e => updateField(e.target.value)}
                    value={colorValue}
                />
            </div>
        </div>
    );
}

export type CustomColorsProps = {
    branding: ReaderBranding;
    updateColor: (colorName: keyof ReaderBranding["stylusOverrideProps"], colorValue: string) => void;
}

export type ColorContrastStatusProps = {
    contrast: Contrast;
}

export const ColorContrastStatus: React.FC<ColorContrastStatusProps> = ({ contrast }) => {
    return (
        <ul className="color-contrast-status">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <span className="color-contrast-info"><FontAwesome name="info-circle" /></span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p><strong>WCAG</strong> - Web Content Accessibility Guidelines.</p>
                        <p><strong>AA</strong> - mid-range level of conformance.</p>
                        <p><strong>AAA</strong> - highest level of conformance.</p>
                        <p>We aim to achieve <strong>at least an AA</strong> level of accessibility; consequently, the contrast ratio should be <strong>no less than 4.5</strong>.</p>
                        <p>Higher contrast ratios make the content more accessible.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <li>Contrast: <strong>{contrast.contrast.toFixed(2)}</strong></li>
            <li>{contrast.wcag_aa_normal ? "✅" : "❌"} WCAG AA (normal size) (min. {WCAG_THRESHOLDS.wcag_aa_normal})</li>
            <li>{contrast.wcag_aa_large ? "✅" : "❌"} WCAG AA (large size) (min. {WCAG_THRESHOLDS.wcag_aa_large})</li>
            <li>{contrast.wcag_aaa_normal ? "✅" : "❌"} WCAG AAA (normal size) (min. {WCAG_THRESHOLDS.wcag_aaa_normal})</li>
            <li>{contrast.wcag_aaa_large ? "✅" : "❌"} WCAG AAA (large size) (min. {WCAG_THRESHOLDS.wcag_aaa_large})</li>
        </ul>
    )
}

const InvalidColorError: React.FC = () => (
    <div className="color-contrast-status color-contrast-status__error">Some of the colors are invalid. Make sure all colors are in either shorthand (#F0A), or full hex format (#FF00AA)</div>
);

export const CustomColors: React.FC<CustomColorsProps> = ({ branding, updateColor }) => {
    const headerContrast = React.useMemo(() => {
        const bg = branding?.stylusOverrideProps?.headerBgColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerBgColor;
        const fg = branding?.stylusOverrideProps?.headerFontColor ?? DEFAULT_BRANDING.stylusOverrideProps.headerFontColor;
        return checkContrast(bg, fg);
    }, [branding])

    const validColors = React.useMemo(() => {
        return validateColors(branding);
    }, [branding])

    return (
        <>
            <ColorRow
                label="Header text color:"
                placeholder={DEFAULT_BRANDING.stylusOverrideProps.headerFontColor}
                colorName="headerFontColor"
                colorValue={branding?.stylusOverrideProps?.headerFontColor}
                updateField={val => updateColor("headerFontColor", val)}
            />
            <ColorRow
                label="Header background color:"
                placeholder={DEFAULT_BRANDING.stylusOverrideProps.headerBgColor}
                colorName="headerBgColor"
                colorValue={branding?.stylusOverrideProps?.headerBgColor}
                updateField={val => updateColor("headerBgColor", val)}
            />
            {
                validColors ?
                    <ColorContrastStatus contrast={headerContrast} /> :
                    <InvalidColorError />
            }
        </>
    );
}

export type ColorPaletteProps = {
    branding: ReaderBranding;
    updateColor: (colorName: keyof ReaderBranding["stylusOverrideProps"], colorVaue: string) => void;
}

export const ColorPalette: React.FC<ColorPaletteProps> = ({ branding, updateColor }) => {
    return (
        <>
            <ColorRow
                label="Primary Color"
                placeholder={DEFAULT_BRANDING.stylusOverrideProps.bgDark}
                colorName="firstColor"
                colorValue={branding?.stylusOverrideProps?.bgDark}
                updateField={value => updateColor("bgDark", value)}
            />
            <ColorRow
                label="Background Color"
                placeholder={DEFAULT_BRANDING.stylusOverrideProps.bgMedium}
                colorName="secondColor"
                colorValue={branding?.stylusOverrideProps?.bgMedium}
                updateField={value => updateColor("bgMedium", value)}
            />
            <ColorRow
                label="Text Color"
                placeholder={DEFAULT_BRANDING.stylusOverrideProps.fgDark}
                colorName="textColor"
                colorValue={branding?.stylusOverrideProps?.fgDark}
                updateField={value => updateColor("fgDark", value)}
            />
        </>
    );
}
