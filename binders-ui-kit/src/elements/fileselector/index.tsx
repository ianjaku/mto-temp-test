import * as React from "react";
import { TranslationKeys } from "@binders/client/lib/react/i18n/translations";
import cx from "classnames";
import { omit } from "ramda";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./fileInput.styl";

export interface IFileSelectorProps {
    onChange?: (files, e) => void;
    accept?: string[];
    name?: string;
    id?: string;
    className?: string;
    multiple?: boolean;
    buttonText?: string;
    label?: string;
}

export interface IFileSelectorState {
    fileNames: string;
}

class FileSelector extends React.Component<IFileSelectorProps, IFileSelectorState> {
    public static defaultProps: Partial<IFileSelectorProps> = {
        multiple: false,
        name: "file",
        onChange: () => ({}),
    };

    private t;

    constructor(props) {
        super(props);
        this.t = props.t;
        this.state = {
            fileNames: undefined,
        };
    }

    componentDidUpdate(prevProps: IFileSelectorProps, _s: IFileSelectorState) {
        if (this.props.label !== prevProps.label) {
            this.setState({ fileNames: undefined })
        }
    }

    public onChange = e => {
        const fileNames = [...e.target.files].map(file => file.name);
        this.props.onChange([...e.target.files], e);
        this.setState({ fileNames: fileNames.join(",") });
    }

    public renderFileNames() {
        const { fileNames } = this.state;
        if (!fileNames) {
            return <span className="files">{this.props.label || this.t(TranslationKeys.General_NoFileChosen) }</span>;
        }
        return <span className="files">{fileNames}</span>;
    }

    public render() {
        const {
            accept = ["*"],
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            onChange = () => ({}),
            className = "",
            buttonText = this.t(TranslationKeys.General_ChooseFile),
            ...props
        } = {
            ...this.props,
        };

        const inputProps: React.HTMLProps<HTMLInputElement> = { ...omit(["t", "tReady"], props) };
        inputProps.accept = accept.join(",");

        const fileNames = this.renderFileNames();

        return (
            <div className={cx("file-input", className)}>
                <label htmlFor={props.name}>
                    {buttonText}
                    <input type="file" {...inputProps} onChange={this.onChange} />
                </label>
                {fileNames}
            </div>
        );
    }
}

export default withTranslation()(FileSelector);
