import * as React from "react";
import { FaIcon, FaIconProps, FaIconTimes } from "../icons/font-awesome";
import { Message, MessageSeverity, useFlashMessageStoreActions } from "./store";
import { FC } from "react";
import { FlashMessageActions } from "./actions";
import { useFlashMessages } from "./hooks";

interface FlashMessageProps {
    id: string;
    severity: MessageSeverity
}

export const FlashMessage: FC<FlashMessageProps> = ({ id, severity, children }) => {
    const key = id;
    const dismissMessage = () => FlashMessageActions.dismissMessage(key);
    const severityAsString = MessageSeverity[severity].toLowerCase();
    const severityClassName = "flashmessage-severity-" + severityAsString;
    let faClass: FaIconProps["name"];
    switch (severity) {
        case MessageSeverity.ERROR:
            faClass = "times-circle";
            break;
        case MessageSeverity.WARNING:
            faClass = "exclamation-triangle";
            break;
        case MessageSeverity.SUCCESS:
            faClass = "check";
            break;
        default:
            faClass = "info-circle";
            break;
    }
    return <div className={"flashmessage " + severityClassName}>
        <FaIcon name={faClass} className={["flashmessage-icon", severityClassName].join(" ")} />
        <div className="flashmessage-content">{children}</div>
        <div className="flashmessage-close" onClick={dismissMessage}> <FaIconTimes /> </div>
    </div>;
}

export const FlashMessages: FC = () => {
    const storeMessages = useFlashMessages();
    const { dismissMessage } = useFlashMessageStoreActions();

    const onButtonClick = (button: Message["buttons"][0], messageKey: string) => {
        if (button.clickDismissesMessage) {
            dismissMessage(messageKey);
        }
        button.onClick?.();
    };

    const messages = storeMessages.map((message) => (
        <FlashMessage key={message.key} id={message.key} severity={message.severity}>
            <label>{message.message}</label>
            {(message.buttons || []).map(button => {
                return (
                    <label
                        className="flashmessage-button"
                        onClick={() => onButtonClick(button, message.key)}
                    >
                        {button.text}
                    </label>
                )
            })
            }
        </FlashMessage>
    ))
    return <div className="flashmessages-wrapper">
        <div className="flashmessage-container">
            {messages}
        </div>
    </div>
}

export default FlashMessages;

