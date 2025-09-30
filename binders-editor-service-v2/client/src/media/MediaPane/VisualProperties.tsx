import * as React from "react";
import {
    EditorEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import {
    FEATURE_MULTILINGUAL_MEDIA,
    FEATURE_VIDEOS_WITH_AUDIO
} from "@binders/client/lib/clients/accountservice/v1/contract";
import { downloadVisual, getDownloadOriginalUrl } from "../helper";
import {
    updateVisualAudio,
    updateVisualAutoPlay,
    updateVisualBgColor,
    updateVisualFitBehaviour,
    updateVisualLanguageCodes,
    updateVisualRotation
} from "../actions";
import AccountStore from "../../accounts/store";
import ColorPicker from "@binders/ui-kit/lib/elements/colorpicker";
import { ComposerContext } from "../../documents/Composer/contexts/composerContext";
import Dropdown from "@binders/ui-kit/lib/elements/dropdown";
import FileDownload from "@binders/ui-kit/lib/elements/icons/FileDownload";
import RadioButton from "@binders/ui-kit/lib/elements/RadioButton";
import RadioButtonGroup from "@binders/ui-kit/lib/elements/RadioButton/RadioButtonGroup";
import RotateRight from "@binders/ui-kit/lib/elements/icons/RotateRight";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import Toggle from "@binders/ui-kit/lib/elements/toggle/Toggle";
import ZoomOutMap from "@binders/ui-kit/lib/elements/icons/ZoomOutMap";
import autobind from "class-autobind";
import classNames from "classnames";
import colors from "@binders/ui-kit/lib/variables";
import { isIE } from "@binders/client/lib/react/helpers/browserHelper";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./MediaPane.styl";

type Props = {
    accountSettings;
    binder;
    imageModuleKey;
    label;
    onDeleteVisual;
    onReplaceVisual;
    onUpdateVisual;
    onVisualViewLarge;
    visual;
    t;
};

type State = {
    backgroundColorCandidate: string;
    featuresAllowVideoAudio: boolean;
    featuresMultilingualMedia: boolean;
};

class VisualProperties extends React.Component<Props, State> {

    static getBgColorFromAccountSettings(props: Props) {
        const { accountSettings, visual } = props;
        const defaultBgColor = ((accountSettings || {}).visuals && accountSettings.visuals.bgColor) || "ffffff";
        return visual.bgColor !== "transparent" ? visual.bgColor : defaultBgColor;
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        if (nextProps.visual.bgColor !== "transparent") {
            return {
                ...prevState,
                backgroundColorCandidate: VisualProperties.getBgColorFromAccountSettings(nextProps),
            }
        }
        return null;
    }

    constructor(props: Props) {
        super(props);
        autobind(this, VisualProperties.prototype);
        this.state = {
            backgroundColorCandidate: VisualProperties.getBgColorFromAccountSettings(props),
            featuresMultilingualMedia: AccountStore.getAccountFeatures().result.includes(FEATURE_MULTILINGUAL_MEDIA),
            featuresAllowVideoAudio: AccountStore.getAccountFeatures().result.includes(FEATURE_VIDEOS_WITH_AUDIO),
        }
    }

    isVisualVideo(visual) {
        return visual.id && visual.id.indexOf("vid") === 0;
    }

    onUpdateVisualFitBehaviour(fitBehaviour) {
        const { binder, onUpdateVisual, visual, imageModuleKey } = this.props;
        updateVisualFitBehaviour(binder.id, visual.id, fitBehaviour);
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { fitBehaviour: fitBehaviour });
        }
        captureFrontendEvent(EditorEvent.MediaPaneBehaviourChanged, { fitBehaviour });
    }

    onUpdateVisualBgColor(color: string) {
        const bgColor = color.replace("#", "");
        const { binder, onUpdateVisual, visual, imageModuleKey } = this.props;
        updateVisualBgColor(binder.id, visual.id, bgColor);
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { bgColor: bgColor });
        }
        captureFrontendEvent(EditorEvent.MediaPaneBackgroundColorChanged, { color });
    }

    onUpdateVisualLanguageCode(languageCode) {
        const { binder, visual, imageModuleKey, onUpdateVisual } = this.props;
        const languageCodes = languageCode === -1 ?
            [] :
            [languageCode];
        updateVisualLanguageCodes(binder.id, visual.id, languageCodes);
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { languageCodes: languageCodes });
        }
        captureFrontendEvent(EditorEvent.MediaPaneLanguageChanged, { languageCode });
    }

    onUpdateEnableVisualAudio() {
        const { binder, imageModuleKey, onUpdateVisual, visual } = this.props;
        const audioEnabled = !visual.audioEnabled;
        updateVisualAudio(binder.id, visual.id, audioEnabled);
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { audioEnabled });
        }
    }

    onUpdateEnableAutoPlay() {
        const { binder, imageModuleKey, onUpdateVisual, visual } = this.props;
        // Update visual in imageservice
        updateVisualAutoPlay(binder.id, visual.id, !visual.autoPlay);
        // Update visual in binder
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { autoPlay: !visual.autoPlay });
        }
    }

    onDelete() {
        const { onDeleteVisual, visual } = this.props;
        onDeleteVisual(visual.id);
    }

    onReplace() {
        const { onReplaceVisual, visual } = this.props;
        onReplaceVisual(visual);
        captureFrontendEvent(EditorEvent.MediaPaneReplaceMediaItem);
    }

    onRotate() {
        const { binder, onUpdateVisual, visual, imageModuleKey } = this.props;
        let rotation;
        if (!visual.rotation) {
            rotation = 90;
        } else {
            rotation = visual.rotation === 270 ? 0 : visual.rotation + 90;
        }
        updateVisualRotation(binder.id, visual.id, rotation);
        if (onUpdateVisual) {
            onUpdateVisual(visual.id, imageModuleKey, { rotation });
        }
        captureFrontendEvent(EditorEvent.MediaPaneTurnMediaItem, { rotation });
    }

    getLanguageElements(visibleLanguages) {
        const { t } = this.props;
        return [{
            id: -1,
            value: -1,
            label: t(TK.General_Unset),
        }].concat(visibleLanguages.map(this.toLanguageElement));
    }

    toLanguageElement(language) {
        return {
            id: language.iso639_1,
            value: language.iso639_1,
            label: language.name,
        };
    }

    buildOnVisualViewLarge(setVisual, visual) {
        const { onVisualViewLarge } = this.props;
        return () => {
            if (onVisualViewLarge) {
                onVisualViewLarge(visual);
            }
            setVisual(visual); // used by the new composer
            captureFrontendEvent(EditorEvent.MediaPaneViewMediaItemLarge);
        }
    }

    renderDownloadButton(child) {
        const inner = isIE() ?
            <a onClick={() => downloadVisual(this.props.visual)}>
                {child}
            </a> :
            <a
                onClick={() => captureFrontendEvent(EditorEvent.MediaPaneDownloadOriginal)}
                href={getDownloadOriginalUrl(this.props.visual, { forceDownload: true })}
                target="_blank"
                rel="noreferrer"
            >
                {child}
            </a>;
        return (
            <li className="visual-properties-actions-action visual-properties-actions-action-download">
                <div className="visual-properties-actions-action-download-container">
                    {inner}
                    <div className="visual-properties-actions-action-download-filler" />
                </div>
            </li>
        );
    }

    renderVisualLanguage() {
        const visibleLanguages = this.props.binder.getVisibleLanguages();
        const { visual } = this.props;
        const elements = this.getLanguageElements(visibleLanguages);
        const languageCode = visual.languageCodes && visual.languageCodes.length > 0 && visual.languageCodes[0];
        return visibleLanguages.length > 1 &&
            (
                <div className="visual-properties-property">
                    <label className="visual-properties-property-label">Language preference</label>
                    {visibleLanguages.length > 1 ?
                        (
                            <Dropdown
                                width={100}
                                type="languages"
                                elements={elements}
                                maxRows={5}
                                maxHeight={140}
                                showBorders={false}
                                arrowColor={colors.accentColor}
                                className="visual-properties-property-dropdown"
                                style={{ fontSize: "12px" }}
                                selectedElementId={languageCode || -1}
                                onSelectElement={this.onUpdateVisualLanguageCode}
                            />
                        ) :
                        (<label>English</label>)}
                    <div />
                </div>
            )
    }

    render() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const color = "currentColor" as any;
        const { visual, label, t } = this.props;
        const { backgroundColorCandidate, featuresAllowVideoAudio } = this.state;
        const radioStyles = {
            mainStyle: {
                width: 100,
            },
            narrowStyle: {
                width: 20
            },
            iconStyle: {
                marginRight: 7,
                width: 16,
                height: 16,
            },
        };
        const smallIconStyle = {
            color,
            fontSize: 12
        }

        const colorValueSelected = visual.bgColor === "transparent" ? "transparent" : "color";

        const actionClass = "visual-properties-actions-action";
        const ctaClass = classNames("visual-properties-actions-action-label", "visual-properties-actions-action-label--cta");
        const isVideo = this.isVisualVideo(visual);
        return (
            <ComposerContext.Consumer>
                {context => (
                    <div className="visual-properties">
                        {label && <label className="visual-properties-label"> {label} </label>}
                        <div className="visual-properties-property">
                            <label className="visual-properties-property-label">{t(TK.General_Behavior)}</label>
                            <RadioButtonGroup
                                name="behaviour"
                                value={visual.fitBehaviour}
                                className="visual-properties-property-radios"
                                row={true}
                            >
                                <RadioButton
                                    iconStyle={radioStyles.iconStyle}
                                    label={t(TK.Visual_Crop)}
                                    onChange={() => this.onUpdateVisualFitBehaviour("crop")}
                                    size="small"
                                    edge="start"
                                    value="crop"
                                    color={color}
                                />
                                <RadioButton
                                    iconStyle={radioStyles.iconStyle}
                                    value="fit"
                                    label={t(TK.Visual_Fit)}
                                    onChange={() => this.onUpdateVisualFitBehaviour("fit")}
                                    size="small"
                                    edge="start"
                                    color={color}
                                />
                            </RadioButtonGroup>
                        </div>
                        <div className="visual-properties-property">
                            <label className="visual-properties-property-label">{t(TK.General_Background)}</label>
                            <RadioButtonGroup
                                name="background"
                                value={colorValueSelected}
                                className="visual-properties-property-radios"
                                row={true}
                            >
                                <RadioButton
                                    iconStyle={radioStyles.iconStyle}
                                    value="transparent"
                                    label={t(TK.General_Transparent)}
                                    onChange={() => this.onUpdateVisualBgColor("transparent")}
                                    size="small"
                                    edge="start"
                                    color={color}
                                />
                                <RadioButton
                                    className="narrow"
                                    iconStyle={radioStyles.iconStyle}
                                    value="color"
                                    label=""
                                    style={radioStyles.narrowStyle}
                                    onChange={() => this.onUpdateVisualBgColor(backgroundColorCandidate)}
                                    size="small"
                                    edge="start"
                                    color={color}
                                />
                            </RadioButtonGroup>
                            <ColorPicker
                                onColorSelect={this.onUpdateVisualBgColor}
                                defaultHexColor={`#${backgroundColorCandidate.replace("#", "")}`}
                            />
                        </div>
                        {isVideo && featuresAllowVideoAudio && (
                            <div className="visual-properties-property">
                                <label className="visual-properties-property-label">{t(TK.Visual_EnableAudio)}</label>
                                <Toggle
                                    isToggled={visual.audioEnabled}
                                    onToggle={this.onUpdateEnableVisualAudio}
                                    isEnabled={true}
                                />
                            </div>
                        )}
                        {isVideo && (
                            <div className="visual-properties-property">
                                <label className="visual-properties-property-label">{t(TK.Visual_AutoPlay)}</label>
                                <Toggle
                                    isToggled={visual.autoPlay}
                                    onToggle={this.onUpdateEnableAutoPlay}
                                    isEnabled={true}
                                />
                            </div>
                        )}
                        <ul className={
                            classNames("visual-properties-actions", "visual-properties-actions--inverted-colors")
                        }>
                            <li className={actionClass}>
                                {ZoomOutMap(smallIconStyle)}
                                <label className={ctaClass} onClick={this.buildOnVisualViewLarge(context.setOpenVisual, visual)}>
                                    {t(TK.Visual_ViewMediaItem)}
                                </label>
                            </li>
                            {
                                this.renderDownloadButton(
                                    (
                                        <span className={actionClass}>
                                            {FileDownload(smallIconStyle)}
                                            <label className={ctaClass}>
                                                {t(TK.Visual_DownloadOriginalFile, { fileName: `${visual.filename}.${visual.extension}` })}
                                            </label>
                                        </span>
                                    )
                                )
                            }
                            {
                                (
                                    <li className={actionClass}>
                                        {RotateRight(smallIconStyle)}
                                        <label className={ctaClass} onClick={this.onRotate}>
                                            {t(TK.Visual_TurnMediaitem)}
                                        </label>
                                    </li>
                                )
                            }
                        </ul>
                    </div>
                )}
            </ComposerContext.Consumer>
        );
    }
}

export default withTranslation()(VisualProperties);
