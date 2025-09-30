import * as QRCode from "qrcode";
import { LOGO_RATIO, QR_CODE_VERSION } from "./constants";
import { QRCodeRenderersOptions } from "qrcode";

export const drawQrOnCanvas = (
    link: string,
    imgElement: HTMLImageElement,
    canvasElement?: HTMLCanvasElement,
    canvasMaxWidth?: number,
    useLogo = false,
    versionOverride?: number,
    secondAttempt = false,
): Promise<HTMLCanvasElement> => {

    const options: QRCodeRenderersOptions = {
        errorCorrectionLevel: useLogo ? "M" : "L",
        margin: 1,
        version: versionOverride || QR_CODE_VERSION,
        width: calculateCanvasWidth(canvasElement, canvasMaxWidth),
    };

    const canvas = canvasElement || document.createElement("canvas") as HTMLCanvasElement;
    return new Promise<HTMLCanvasElement>((resolve, reject) => {
        QRCode.toCanvas(canvas, link, options, (err) => {
            if (!err) {
                if (useLogo) {
                    drawScaledLogo(imgElement, canvas, Math.round(canvas.width / LOGO_RATIO));
                }
                return resolve(canvas);
            }
            if (!secondAttempt && err.message.indexOf("Minimum version required") > -1) {
                const lines = err.message.split("\n");
                const versionLine = lines.find(l => l.indexOf("Minimum version required") === 0);
                const requiredVersion = versionLine.substring(versionLine.indexOf(": ") + 1);
                const version = parseInt(requiredVersion, 10);
                return resolve(drawQrOnCanvas(
                    link,
                    imgElement,
                    canvasElement,
                    canvasMaxWidth,
                    useLogo,
                    version,
                ));
            }
            reject(err);
        });
    });
};

const isImageLoaded = (img: HTMLImageElement): boolean => {
    return img.complete && (typeof img.naturalWidth === "undefined" || img.naturalWidth !== 0);
};

const scaleImage = (
    source: HTMLImageElement,
    width: number,
    height: number
): HTMLCanvasElement => {
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    drawImage(source, tempCanvas.getContext("2d"), 0, 0, width, height);
    return tempCanvas;
};

const drawScaledLogo = (
    imgElement: HTMLImageElement,
    canvas: HTMLCanvasElement,
    logoSize: number
): void => {
    const scaledLogo = scaleImage(imgElement, logoSize * 2, logoSize * 2);
    const ctx = canvas.getContext("2d");
    if (ctx) {
        ctx.drawImage(
            scaledLogo,
            (canvas.width / 2) - (logoSize / 2),
            (canvas.width / 2) - (logoSize / 2),
            logoSize,
            logoSize,
        );
    }
};

const drawImage = (
    source: HTMLImageElement,
    ctx: CanvasRenderingContext2D | null,
    x: number,
    y: number,
    width: number,
    height: number,
): void => {
    if (ctx && isImageLoaded(source)) {
        ctx.drawImage(source, x, y, width, height);
        return;
    }
    source.onload = () => {
        if (ctx) {
            ctx.drawImage(source, x, y, width, height);
        }
    }
};

const calculateCanvasWidth = (canvasParentElement: HTMLElement, canvasMaxWidth?: number): number => {
    const { paddingLeft, paddingRight } = getComputedStyle(canvasParentElement);
    const padding = parseFloat(paddingLeft) + parseFloat(paddingRight);
    const width = canvasParentElement.clientWidth - padding;
    return Math.min(width, canvasMaxWidth ?? 2000);
};
