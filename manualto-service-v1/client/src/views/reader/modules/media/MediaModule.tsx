import * as React from "react";
import { TFunction, withTranslation } from "@binders/client/lib/react/i18n";
import { BinderVisual } from "@binders/client/lib/clients/repositoryservice/v3/BinderVisual";
import { IDims } from "@binders/client/lib/clients/imageservice/v1/contract";
import { MediaFragments } from "./MediaFragments";
import { PreloadingProvider } from "./PreloadingProvider/PreloadingProvider";
import { VideoAuthProvider } from "./VideoFragment/videoplayer/auth/VideoAuthProvider";
import { assoc } from "ramda";
import autobind from "class-autobind";
import cx from "classnames";
import debounce from "lodash.debounce";
import { getVisualBackground } from "./visualHelpers";
import { isIOSSafari } from "@binders/client/lib/react/helpers/browserHelper";
import { useClosestChunkWithImageIndex } from "../../../../stores/hooks/chunk-position-hooks";
import { withHooks } from "@binders/client/lib/react/hooks/withHooks";
import "./MediaModule.styl";

interface MediaModuleProps {
    chunks: BinderVisual[][];
    t: TFunction;
    languageCode: string;
    waitingForResize: boolean;
    windowDimensions: IDims;
    imageViewportDims: IDims;
    setImageViewportDims: (width: number, height: number) => void;
    closestImageChunk: number;
    isLandscape: boolean;
    setTailSlotRef?: React.LegacyRef<HTMLDivElement>;
}

interface MediaModuleState {
    chunks: BinderVisual[][];
    carouselPositions: { [chunkPosition: number]: number };
    isAudioEnabled: boolean;
    requestNewTokenAttempts: { [url: string]: number };
}

class MediaModuleClass extends React.Component<MediaModuleProps, MediaModuleState> {
    private skipTransition = false;
    private firstImageWrapperRef: HTMLDivElement = undefined;
    private debouncedRetrieveViewportDims = debounce(this.retrieveViewportDims.bind(this), 500, { leading: true });

    constructor(props: MediaModuleProps) {
        super(props);
        autobind(this);
        this.state = {
            chunks: [],
            isAudioEnabled: false,
            // chunkPosition -> activeCarouselPosition (default: 0)
            carouselPositions: {},
            requestNewTokenAttempts: {},
        };
    }

    componentDidMount() {
        this.debouncedRetrieveViewportDims();
        this.setState({
            chunks: this.getImageChunks(this.props.chunks),
            isAudioEnabled: false,
        });
    }

    componentDidUpdate(previousProps: MediaModuleProps) {
        const { languageCode: previousLanguageCode, waitingForResize: previousWaitingForResize,
            windowDimensions: prevWindowDimensions } = previousProps;
        const { chunks: chunksProp, languageCode, waitingForResize, windowDimensions } = this.props;
        if (prevWindowDimensions !== windowDimensions) {
            this.debouncedRetrieveViewportDims();
        }
        this.skipTransition = (waitingForResize === true || previousWaitingForResize === true);

        if (previousProps.chunks === this.props.chunks) return;
        const chunks = this.getImageChunks(chunksProp);
        if (languageCode !== previousLanguageCode) {
            this.setState({
                chunks,
            });
        }
    }

    private adaptToDevicePixelRatio(dim: number) {
        return dim * (window.devicePixelRatio || 1);
    }

    private retrieveViewportDims() {
        const { imageViewportDims, setImageViewportDims } = this.props;
        const viewPortArr = Array.from(document.getElementsByClassName("media-viewport")) as HTMLDivElement[];
        if (!viewPortArr.length) {
            return;
        }
        const [{ offsetWidth: imgOffsetWidth, offsetHeight: imgOffsetHeight }] = viewPortArr;
        if (isIOSSafari() && (imgOffsetHeight === 0 || imgOffsetWidth === 0)) {
            return;
        }
        const imgOffsetWidthNormalized = this.adaptToDevicePixelRatio(imgOffsetWidth);
        const imgOffsetHeightNormalized = this.adaptToDevicePixelRatio(imgOffsetHeight);
        const { width: imageViewportWidth, height: imageViewportHeight } = imageViewportDims || {};
        if ((imageViewportWidth !== imgOffsetWidthNormalized || imageViewportHeight !== imgOffsetHeightNormalized)) {
            setTimeout(() => setImageViewportDims(imgOffsetWidthNormalized, imgOffsetHeightNormalized), 0);
        }
    }

    private turnImagesToCommonForm(chunk: BinderVisual[]): BinderVisual[] {
        return chunk.map(image => {
            if (typeof image === "string") {
                return {
                    url: image,
                    bgColor: null,
                    id: null,
                    languageCodes: [],
                    fitBehaviour: "fit"
                } as unknown as BinderVisual;
            }
            return image;
        });
    }

    private sortChunkByLanguage(chunk: BinderVisual[]) {
        const { languageCode } = this.props;
        const activeLanguageOccurs = chunk.some(c => (c.languageCodes || []).includes(languageCode));
        if (!activeLanguageOccurs) {
            return chunk;
        }
        return chunk.sort((a, b) => {
            const aLanguageCode = a.languageCodes && a.languageCodes.length && a.languageCodes[0];
            const bLanguageCode = b.languageCodes && b.languageCodes.length && b.languageCodes[0];
            if (aLanguageCode && aLanguageCode === languageCode) {
                return -1;
            }
            if (bLanguageCode && bLanguageCode === languageCode) {
                return 1;
            }
            return 0;
        });
    }

    private getImageChunks(chunks: BinderVisual[][]) {
        return chunks
            .map((chunk, i) => !(chunk.length) && i > 0 ? undefined : chunk)
            .filter(c => !!c)
            .map(this.turnImagesToCommonForm)
            .map((imageChunk) => {
                return this.sortChunkByLanguage(imageChunk);
            });
    }

    private toggleAudio() {
        this.setState({ isAudioEnabled: !this.state.isAudioEnabled });
    }

    private handleCarouselPositionChange(newCarouselPosition: number, chunkPosition: number) {
        const positions = this.state.carouselPositions;
        if (positions[chunkPosition] != newCarouselPosition) {
            const newPositions = assoc(chunkPosition, newCarouselPosition, positions)
            this.setState({ carouselPositions: newPositions })
        }
    }

    render() {
        const {
            closestImageChunk,
            isLandscape: isViewportLandscape
        } = this.props;


        const defaultChunkOffset = `-${closestImageChunk * 100}${isViewportLandscape ? "vh" : "vw"}`;
        const chunkOffset = (this.firstImageWrapperRef && `-${closestImageChunk * this.firstImageWrapperRef.clientHeight}px`) || defaultChunkOffset;

        return (
            <VideoAuthProvider visuals={this.state.chunks.flat()}>
                <PreloadingProvider
                    chunks={this.state.chunks}
                    activeChunkIndex={closestImageChunk}
                    carouselPositions={this.state.carouselPositions}
                >
                    <div className="media-module">
                        <div
                            className="media-viewport"
                            style={{ top: chunkOffset, transition: this.skipTransition === true ? "none" : null }}
                        >
                            {this.state.chunks.map((chunkVisuals, chunkPosition) => (
                                <div
                                    key={`media-wrapper-${chunkPosition}`}
                                    className={cx("image-wrapper")}
                                    style={{ backgroundColor: getVisualBackground(chunkVisuals && chunkVisuals[0]) }}
                                    ref={ref => { if (chunkPosition === 0) { this.firstImageWrapperRef = ref } }}
                                >
                                    <MediaFragments
                                        key={`visual-at-chunk-${chunkPosition}`}
                                        visuals={chunkVisuals}
                                        imageViewportDims={this.props.imageViewportDims}
                                        isAudioEnabled={this.state.isAudioEnabled}
                                        isActive={chunkPosition === closestImageChunk}
                                        toggleAudio={() => this.toggleAudio()}
                                        chunkPosition={chunkPosition}
                                        handleCarouselPositionChange={(newCarouselPosition, chunkPosition) => (
                                            this.handleCarouselPositionChange(newCarouselPosition, chunkPosition)
                                        )}
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="rounded-shadow" />
                    </div>
                </PreloadingProvider>
                <div className="media-module-tailslot" ref={this.props.setTailSlotRef}></div>
            </VideoAuthProvider>
        );
    }
}

const MediaModuleWithHooks = withHooks(MediaModuleClass, () => ({
    closestImageChunk: useClosestChunkWithImageIndex(),
}))
export const MediaModule = withTranslation()(MediaModuleWithHooks);
