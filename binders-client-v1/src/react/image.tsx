/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import * as React from "react";
import { pick, replace } from "ramda";
import { isVideoURL } from "../clients/imageservice/v1/visuals";

export type Unit = "%" | "vw";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getFitCropStyleObject(fitBehaviour: string, aspectRatio: number, unit: Unit = "%") {
    const isLandscape = aspectRatio > 1;
    const addUnit = (amount: number) => `${amount}${unit}`;
    if (fitBehaviour === "fit") {
        if (isLandscape) {
            return {
                width: addUnit(100)
            };
        } else {
            const style = {
                height: addUnit(100),
                width: addUnit(Math.round(100 * aspectRatio))
            };
            return style;
        }
    } else {
        if (isLandscape) {
            return {
                left: addUnit(50),
                top: addUnit(50),
                height: addUnit(100),
                width: "auto",
                transform: `translate(-${addUnit(50)},-${addUnit(50)})`,
                position: "absolute"
            };
        } else {
            return {
                width: addUnit(100)
            };
        }
    }
}


export interface ImageProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    image?: any;
    isOver?: boolean;
    dirtyDownSize?: boolean;
    className: string;
}

export interface ImageState {
    bgColor: string;
    width?: number;
    height?: number;
}

export default class Image extends React.Component<ImageProps, ImageState> {

    constructor(props) {
        super(props);
        this.state = {
            bgColor: props.image ? props.image.bgColor : "",
        };
    }

    handleImageLoaded(e) {
        this.setState({
            bgColor: this.props.image.bgColor,
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
    }

    dirtyDownsizeImageImg(img) {
        let url;
        if (img.url) {
            url = img.url;
        } else {
            url = img;
        }
        let replaceTarget = "/medium";
        if (isVideoURL(url)) {
            replaceTarget = "/video_screenshot";
        }
        return replace(/\/original/, replaceTarget, url);
    }

    getImageSrc() {
        if (this.props.dirtyDownSize) {
            return this.dirtyDownsizeImageImg(this.props.image);
        }
        if (this.props.image.buildRenderUrl) {
            return this.props.image.buildRenderUrl();
        }
        if (this.props.image.medium) {
            return this.props.image.medium;
        }
        return this.props.image;
    }

    getImageProps() {
        const { rotation }  = this.props.image;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const imageProps: any = {
            ...pick(["style", "alt"], this.props),
            className: this.props.isOver ? "hovering" : "",
            src: this.getImageSrc(),
            onLoad: this.handleImageLoaded.bind(this)
        };
        let rotationStyle = {};
        imageProps.style = Object.assign(imageProps.style ? imageProps.style : {}, this.getFitCropStyling());
        if(rotation) {
            const rotate = `rotate(${rotation}deg)`;
            rotationStyle = {transform:  (imageProps.style.transform) ? `${imageProps.style.transform} ${rotate}` : rotate};
            imageProps.style = {...imageProps.style, ...rotationStyle};
        }
        return imageProps;
    }

    getFitCropStyling() {
        return getFitCropStyleObject(this.props.image.fitBehaviour, this.getAspectRatio());
    }

    getAspectRatio() {
        return this.state.height ?
            this.state.width / this.state.height :
            1;
    }

    render() {
        const isTransparent = this.props.image.bgColor === "transparent";
        const wrapperStyle = { backgroundColor: isTransparent ? "inherit" : `#${this.props.image.bgColor}` } as React.CSSProperties;

        return (
            <div className={`${this.props.className ? this.props.className : ""} image-wrapper ${(isTransparent ? " transparent" : "")}`} style={wrapperStyle}>
                <div className="image-container">
                    <img {...this.getImageProps() } />
                </div>
            </div>
        );
    }

}
