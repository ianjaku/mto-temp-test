import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    FEATURE_MULTILINGUAL_MEDIA,
    FEATURE_VIDEOS_WITH_AUDIO,
    IAccountSettings
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { useActiveAccountFeatures, useActiveAccountSettings } from "../../accounts/hooks";
import BinderClass from "@binders/client/lib/binders/custom/class";
import ColorPicker from "@binders/ui-kit/lib/elements/colorpicker";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown/index";
import { VisualSettings as IVisualSettings } from "@binders/client/lib/clients/repositoryservice/v3/contract";
import Input from "@binders/ui-kit/lib/elements/input";
import RotateLeft from "@binders/ui-kit/lib/elements/icons/RotateLeft/index";
import RotateRight from "@binders/ui-kit/lib/elements/icons/RotateRight/index";
import { SetStateBinderFn } from "../../documents/Composer/hooks/useStateBinder";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import colors from "@binders/ui-kit/lib/variables/index";
import { curriedUpdateBinder } from "@binders/client/lib/binders/custom/class";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { isVideoId } from "@binders/client/lib/clients/imageservice/v1/visuals";
import { patchImageEditPropsAtIndex } from "../../documents/actions/editing";
import { useEffect } from "react";
import { useTranslation } from "@binders/client/lib/react/i18n";
import { useUpdateChunkVisualSetting } from "../../documents/hooks";
import "./VisualSettings.styl";

const isValidColor = (candidate: string) => /^#([A-Fa-f0-9]{6})$/.test(candidate);

export const VisualSettings: React.FC<{
    binder: BinderClass,
    chunkIdx: number,
    visualId: string,
    visualIdx: number,
    visualProps: IVisualSettings,
    setStateBinder: SetStateBinderFn,
}> = ({ binder, visualId, visualProps, setStateBinder, chunkIdx, visualIdx }) => {
    const { t } = useTranslation();
    const accountFeatures = useActiveAccountFeatures();
    const binderId = binder.id;
    const { mutate: updateSettingsFn } = useUpdateChunkVisualSetting({ binderId, chunkIdx, visualIdx });

    const onUpdateVisual = React.useCallback((props: Record<string, unknown>) => {
        const moduleIndex = binder.getImagesModuleIndex("i1");
        const patch = () => patchImageEditPropsAtIndex(binder, moduleIndex, chunkIdx, visualIdx, props);
        setStateBinder(curriedUpdateBinder(patch, true), undefined, undefined, false, true);
    }, [binder, chunkIdx, setStateBinder, visualIdx]);

    const onUpdateVisualFitBehaviour = React.useCallback((fitBehaviour) => {
        updateSettingsFn({ fitBehaviour });
        onUpdateVisual({ fitBehaviour });
        captureFrontendEvent(EditorEvent.MediaPaneBehaviourChanged, { fitBehaviour });
    }, [onUpdateVisual, updateSettingsFn]);

    const onUpdateVisualBgColor = React.useCallback((color: string) => {
        const bgColor = color.replace("#", "");
        updateSettingsFn({ bgColor });
        onUpdateVisual({ bgColor });
        captureFrontendEvent(EditorEvent.MediaPaneBackgroundColorChanged, { color });
    }, [onUpdateVisual, updateSettingsFn]);

    const onUpdateVisualLanguageCode = React.useCallback((languageCode) => {
        const languageCodes = languageCode === -1 ? [] : [languageCode];
        updateSettingsFn({ languageCodes });
        onUpdateVisual({ languageCodes });
        captureFrontendEvent(EditorEvent.MediaPaneLanguageChanged, { languageCode });
    }, [onUpdateVisual, updateSettingsFn]);

    const onUpdateEnableVisualAudio = React.useCallback(() => {
        const audioEnabled = !visualProps.audioEnabled;
        updateSettingsFn({ audioEnabled });
        onUpdateVisual({ audioEnabled });
    }, [onUpdateVisual, updateSettingsFn, visualProps.audioEnabled]);

    const onUpdateEnableAutoPlay = React.useCallback(() => {
        const autoPlay = !visualProps.autoPlay;
        updateSettingsFn({ autoPlay });
        onUpdateVisual({ autoPlay });
    }, [onUpdateVisual, updateSettingsFn, visualProps.autoPlay]);

    const onRotate = React.useCallback((direction: "left" | "right") => {
        const rotationDegrees = direction === "right" ? 90 : 270;
        const rotation = ((visualProps.rotation || 0) + rotationDegrees) % 360;
        updateSettingsFn({ rotation });
        onUpdateVisual({ rotation });
        captureFrontendEvent(EditorEvent.MediaPaneTurnMediaItem, { rotation });
    }, [onUpdateVisual, updateSettingsFn, visualProps.rotation]);

    const shouldShowVideoSettings = isVideoId(visualId);
    const featuresAllowVideoAudio = accountFeatures.includes(FEATURE_VIDEOS_WITH_AUDIO);
    const featuresMultilingualMedia = accountFeatures.includes(FEATURE_MULTILINGUAL_MEDIA);
    const binderVisibleLanguages = binder.getVisibleLanguages();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    return (
        <div className="visual-setting-scrollcontainer" ref={scrollContainerRef}>
            <div className="visual-settings">
                {shouldShowVideoSettings &&
                    <div className="visual-settings-group">
                        <div className="visual-settings-group-name">{t(TK.Edit_VisualSettings_AudioAndPlayback)}</div>
                        {featuresAllowVideoAudio &&
                            <SoundControl
                                audioEnabled={visualProps.audioEnabled}
                                onUpdateAudioEnabled={onUpdateEnableVisualAudio}
                            />
                        }
                        <AutoPlayControl
                            autoPlay={visualProps.autoPlay}
                            onUpdateAutoPlay={onUpdateEnableAutoPlay}
                        />
                    </div>
                }
                <div className="visual-settings-group">
                    <label className="visual-settings-group-name">{t(TK.General_Background)}</label>
                    <BackgroundColorControl
                        backgroundColor={visualProps.bgColor}
                        onUpdateVisualBgColor={onUpdateVisualBgColor}
                    />
                </div>
                <div className="visual-settings-group">
                    <div className="visual-settings-group-name">{t(TK.Edit_VisualSettings_Transform)}</div>
                    <FitBehaviorControl
                        fitBehavior={visualProps.fitBehaviour}
                        onUpdateVisualFitBehaviour={onUpdateVisualFitBehaviour}
                    />
                    <RotationControl onUpdateRotation={onRotate} />
                </div>
                {featuresMultilingualMedia && (binderVisibleLanguages && binderVisibleLanguages.length > 1) &&
                    <div className="visual-settings-group">
                        <div className="visual-settings-group-name">{t(TK.Edit_VisualSettings_Language)}</div>
                        <VisualLanguageControl
                            visualLanguageCodes={visualProps.languageCodes}
                            onUpdateVisualLanguageCode={onUpdateVisualLanguageCode}
                            binderLanguages={binderVisibleLanguages}
                        />
                    </div>
                }
            </div>
        </div>
    );
};

const FitBehaviorControl: React.FC<{
    fitBehavior: "fit" | "crop",
    onUpdateVisualFitBehaviour: (fitBehaviour: "fit" | "crop") => void,
}> = ({ fitBehavior, onUpdateVisualFitBehaviour }) => {
    const { t } = useTranslation();
    return (
        <div className="visual-setting">
            <Toggle
                isToggled={fitBehavior === "fit"}
                onToggle={() => onUpdateVisualFitBehaviour(fitBehavior === "fit" ? "crop" : "fit")}
                isEnabled={true}
                testId="visual-settings-transform-toggle"
            />
            <div>{fitBehavior === "fit" ? t(TK.Visual_Fit) : t(TK.Visual_Crop)}</div>
        </div>
    );
}

function resolveBackgroundColor(accountSettings: IAccountSettings, visualBackgroundColor: string) {
    if (visualBackgroundColor !== "transparent") {
        return visualBackgroundColor;
    }
    return accountSettings?.visuals?.bgColor || "ffffff";
}

const BackgroundColorControl: React.FC<{
    backgroundColor: string,
    onUpdateVisualBgColor: (color: string) => void,
}> = ({ backgroundColor, onUpdateVisualBgColor }) => {
    const { t } = useTranslation();
    const accountSettings = useActiveAccountSettings();
    const backgroundColorCandidate = React.useMemo(() => resolveBackgroundColor(accountSettings, backgroundColor), [accountSettings, backgroundColor]);
    const [inputValue, setInputValue] = React.useState(`#${backgroundColorCandidate.replace("#", "")}`);
    const inputValueRef = React.useRef(inputValue);

    const colorValueSelected = backgroundColor === "transparent" ? "transparent" : "color";

    useEffect(() => {
        setInputValue(`#${backgroundColorCandidate.replace("#", "")}`);
    }, [backgroundColorCandidate]);

    useEffect(() => {
        inputValueRef.current = inputValue; // Keep ref in sync with state
    }, [inputValue]);

    useEffect(() => {
        return () => {
            // save any pending valid color on unmount
            if (isValidColor(inputValueRef.current) && inputValueRef.current !== `#${backgroundColorCandidate.replace("#", "")}`) {
                onUpdateVisualBgColor(inputValueRef.current);
            }
        };
    }, [backgroundColorCandidate, onUpdateVisualBgColor]);

    const isDisabled = colorValueSelected === "transparent";

    return (
        <>
            <div className="visual-setting">
                <div className="visual-bgcolor-setting-transparent-toggle">
                    <Toggle
                        isToggled={colorValueSelected === "transparent"}
                        onToggle={() => onUpdateVisualBgColor(colorValueSelected === "transparent" ? backgroundColorCandidate : "transparent")}
                    />
                </div>
                <div>{t(TK.General_Transparent)}</div>
            </div>
            <div className={cx("visual-setting", "visual-setting--forceLeftAlign")}>
                <ColorPicker
                    onColorSelect={onUpdateVisualBgColor}
                    defaultHexColor={`#${backgroundColorCandidate.replace("#", "")}`}
                    renderFunction={(selectedHexColor, setColorPickerState) => {
                        return (
                            <div
                                className={cx(
                                    "visual-bgcolor-setting-colorpicker-container",
                                    isDisabled ? "visual-bgcolor-setting-colorpicker-container__disabled" : null,
                                )}
                                onClick={e => { if (isDisabled) e.stopPropagation(); }}
                            >
                                <div
                                    className="visual-bgcolor-setting-colorpicker-swatch"
                                    style={{
                                        backgroundColor: selectedHexColor,
                                        ...(colorValueSelected === "transparent" ? { border: "1px solid #ccc" } : {}),
                                    }}
                                />
                                <Input
                                    value={inputValue}
                                    disabled={isDisabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onChange={(newValue: string) => {
                                        setInputValue(newValue);
                                    }}
                                    onBlur={(e) => {
                                        const candidate = (e.target as HTMLInputElement).value;
                                        if (isValidColor(candidate)) {
                                            setColorPickerState(candidate);
                                        } else {
                                            setInputValue(selectedHexColor);
                                        }
                                    }}
                                    onEnterKey={() => {
                                        if (isValidColor(inputValue)) {
                                            setColorPickerState(inputValue);
                                        }
                                    }}
                                    width={80}
                                />
                            </div>
                        );
                    }}
                />
            </div>
        </>
    );
}

const VisualLanguageControl: React.FC<{
    visualLanguageCodes: string[] | undefined,
    onUpdateVisualLanguageCode: (languageCode: string) => void,
    binderLanguages: { iso639_1: string, name: string }[],
}> = ({ visualLanguageCodes, binderLanguages, onUpdateVisualLanguageCode }) => {
    const { t } = useTranslation();
    const elements = getLanguageElements(binderLanguages, t(TK.General_Unset));
    return (
        <div className="visual-setting">
            <div style={{ ...(isMobileView() ? {} : { maxWidth: "200px" }) }}>
                <Dropdown
                    width={200}
                    type="languages"
                    elements={elements}
                    maxRows={5}
                    maxHeight={140}
                    showBorders={false}
                    arrowColor={colors.accentColor}
                    className="visual-setting-dropdown"
                    selectedElementId={visualLanguageCodes?.at(0) || -1}
                    onSelectElement={onUpdateVisualLanguageCode}
                />
                <span className="visual-language-control-setting-info">
                    {t(TK.Edit_VisualSettings_LanguageHint)}
                </span>
            </div>
        </div>
    );
}

const getLanguageElements = (visibleLanguages: { iso639_1: string, name: string }[], unsetLabel: string) => {
    return [
        { id: -1, value: -1, label: unsetLabel },
        ...visibleLanguages.map(language => ({
            id: language.iso639_1,
            value: language.iso639_1,
            label: language.name,
        }))
    ]
}

const SoundControl: React.FC<{
    audioEnabled: boolean,
    onUpdateAudioEnabled: () => void,
}> = ({ audioEnabled, onUpdateAudioEnabled }) => {
    const { t } = useTranslation();
    return (
        <div className="visual-setting">
            <Toggle
                isToggled={!audioEnabled}
                onToggle={onUpdateAudioEnabled}
                isEnabled={true}
            />
            <label>{t(TK.Edit_VisualSettings_MuteSound)}</label>
        </div>
    );
}

const AutoPlayControl: React.FC<{
    autoPlay: boolean,
    onUpdateAutoPlay: () => void,
}> = ({ autoPlay, onUpdateAutoPlay }) => {
    const { t } = useTranslation();
    return (
        <div className="visual-setting">
            <Toggle
                isToggled={autoPlay}
                onToggle={onUpdateAutoPlay}
                isEnabled={true}
            />
            <div>{t(TK.Visual_AutoPlay)}</div>
        </div>
    )
}

const RotationControl: React.FC<{
    onUpdateRotation: (direction: "left" | "right") => void,
}> = ({ onUpdateRotation }) => {
    return (
        <div className={cx("visual-setting", "visual-setting--forceLeftAlign")}>
            <div className="rotation-buttons">
                <button className="rotation-button" onClick={() => onUpdateRotation("right")}>
                    {RotateRight({ fontSize: 20 })}
                </button>
                <button className="rotation-button" onClick={() => onUpdateRotation("left")}>
                    {RotateLeft({ fontSize: 20 })}
                </button>
            </div>
        </div>
    )
}
