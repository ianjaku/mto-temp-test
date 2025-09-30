import React, { useCallback, useEffect, useRef } from "react";
import QR_CODE_LOGO from "../../../public/m-logo.svg";
import { drawQrOnCanvas } from "./helpers";
import { usePrevious } from "@binders/client/lib/react/helpers/hooks";
import "./QrCode.styl";

interface Props {
    link: string;
    useLogo?: boolean;
    canvasMaxWidth?: number;
    setDownloadableImage?: (downloadableImage: string) => void;
    setCopyableBlob?: (blob: Blob) => void;
    style?: React.CSSProperties;
}

export const QrCode: React.FC<Props> = ({ link, useLogo, canvasMaxWidth, setDownloadableImage, setCopyableBlob, style }) => {
    const qrCodeCanvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const prevLink = usePrevious(link);

    const onLoadImgAsync = useCallback(async () => {
        try {
            const canvas = await drawQrOnCanvas(
                link,
                imgRef.current,
                qrCodeCanvasRef.current,
                canvasMaxWidth,
                useLogo
            );
            if (setDownloadableImage) {
                setDownloadableImage(canvas.toDataURL("image/png", 1))
            }
            if (setCopyableBlob) {
                canvas.toBlob(blob => {
                    if (blob) {
                        setCopyableBlob(blob);
                    }
                });
            }
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
        }
    }, [canvasMaxWidth, link, setDownloadableImage, setCopyableBlob, useLogo])

    useEffect(() => {
        if (link && prevLink && link !== prevLink) {
            onLoadImgAsync();
        }
    }, [link, prevLink, onLoadImgAsync])

    return (
        <div className="qrCode" style={style || {}}>
            <img
                style={{ display: "none" }}
                className="qrCode-dataLogo"
                ref={imgRef}
                src={QR_CODE_LOGO}
                onLoad={onLoadImgAsync}
            />
            <canvas
                className="qrCode-dataImage"
                ref={qrCodeCanvasRef}
            />
        </div>
    )
}
