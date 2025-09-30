/* eslint-disable @typescript-eslint/ban-types */
import * as React from "react";
import { Logo, ReaderBranding } from "@binders/client/lib/clients/routingservice/v1/contract";
import { DropTarget } from "react-dnd";
import FontAwesome from "react-fontawesome";
import { NativeTypes } from "react-dnd-html5-backend";
import { buildTokenUrl } from "@binders/client/lib/clients/authorizationservice/v1/helpers";
import "./logo-uploader.styl";

interface LogoUploaderProps {
    connectDropTarget: Function;
    logo: Logo;
    urlToken: string | null;
    onImageUpdate: Function;
    onFileReceived: Function;
    onDelete: Function;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface LogoUploaderState { }

const LOGO_ACCEPTED_MIMES: string[] = [
    "image/svg+xml",
    "image/png",
    "image/jpeg",
];

export function getUrlFromLogo(logo: ReaderBranding["logo"], urlToken: string): string | null {
    if (logo == null || urlToken == null) return null;
    const isDataLogo = logo?.url?.startsWith("data:");
    return (urlToken && !isDataLogo) ?
        buildTokenUrl(logo.url, urlToken) :
        logo.url;
}


class LogoUploader extends React.Component<LogoUploaderProps, LogoUploaderState> {
    private uploadInputField: HTMLInputElement;

    constructor(props: LogoUploaderProps) {
        super(props);

        this.browseFiles = this.browseFiles.bind(this);
        this.updateLogoImageField = this.updateLogoImageField.bind(this);
        this.setupUploadedImagePreview = this.setupUploadedImagePreview.bind(this);
        this.renderInputFileMessage = this.renderInputFileMessage.bind(this);
    }

    browseFiles(e, preventDefault = false) {
        if (preventDefault) {
            e.preventDefault();
        }
        this.uploadInputField.click();
    }

    updateLogoImageField(e) {
        const [file] = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        this.props.onFileReceived(file);
        this.setupUploadedImagePreview(file);
    }

    setupUploadedImagePreview(file) {
        const reader = new FileReader();
        if (!reader || !file) {
            return;
        }

        reader.onload = () => this.props.onImageUpdate({
            url: reader.result,
            mime: file.type,
            size: 1024
        });

        reader.readAsDataURL(file);
    }

    renderInputFileMessage() {
        const { logo } = this.props;
        const hasNoLogo = (logo === undefined || logo === null || !logo.url);

        return hasNoLogo && (
            <p>
                Drag and drop here or
                <a href="#" onClick={e => this.browseFiles(e, true)}> browse</a>
            </p>
        );
    }

    async downloadLogo() {
        if (this.props.logo == null) return;
        // We have to fetch the image and turn it into a blob,
        // because firefox does not allow downloading cross origin content
        const blob = await fetch(getUrlFromLogo(this.props.logo, this.props.urlToken)).then(res => res.blob());
        const dataUrl = URL.createObjectURL(blob);

        // We create a anchor element and click it to download the image
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "logo";
        // Just in case a future browser stops supporting this, we open the image in a new tab
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    render() {
        const { connectDropTarget, logo, urlToken } = this.props;
        const backgroundImage = logo ? `url(${getUrlFromLogo(logo, urlToken)})` : undefined;
        const onFieldClick = e => logo ? this.browseFiles(e) : undefined;

        return connectDropTarget(
            <div className="upload-logo">
                <div
                    className="upload-logo-field"
                    style={{ backgroundImage }}
                    onClick={onFieldClick}
                >
                    {this.renderInputFileMessage()}
                    <input
                        type="file"
                        name="logo"
                        accept={LOGO_ACCEPTED_MIMES.join(", ")}
                        ref={ref => { this.uploadInputField = ref; }}
                        onChange={this.updateLogoImageField}
                        style={{ display: "none" }}
                    />
                </div>
                {logo && (
                    <div className="upload-logo-actions">
                        <div className="upload-logo-action" onClick={() => this.downloadLogo()}>
                            <FontAwesome name="download" /> Download
                        </div>
                        <div className="upload-logo-action" onClick={() => this.props.onDelete()}>
                            <FontAwesome name="trash" /> Delete
                        </div>
                    </div>
                )}
            </div>
        );
    }
}

// tslint:disable-next-line:variable-name
const FileTargetSpec = {
    drop: (props, monitor, component: LogoUploader) => {
        if (monitor) {
            const monitorItem = monitor.getItem();
            const [file] = monitorItem.files;
            if (file && LOGO_ACCEPTED_MIMES.indexOf(file.type) > -1) {
                props.onFileReceived(file);
                component.setupUploadedImagePreview(file);
            }
        }
    }
};

export default DropTarget(
    () => ([NativeTypes.FILE]),
    FileTargetSpec,
    (connect, monitor) => ({
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
    }),
)(LogoUploader);
