import * as React from "react";
import {
    ReaderEvent,
    captureFrontendEvent
} from "@binders/client/lib/thirdparty/tracking/capture";
import { useCallback, useMemo, useRef } from "react";
import { APIMultiInsertUserAction } from "../../../../../api/trackingService";
import Button from "@binders/ui-kit/lib/elements/button";
import { ContentChunkProps } from "../types";
import Icon from "@binders/ui-kit/lib/elements/icons";
import {
    READ_CONFIRMATION_CHUNK_DATAPROP
} from "@binders/client/lib/clients/repositoryservice/v3/helpers";
import ReactDOM from "react-dom";
import { TK } from "@binders/client/lib/react/i18n/translations";
import { UserActionType } from "@binders/client/lib/clients/trackingservice/v1/contract";
import { VerticalCenter } from "../VerticalCenter";
import cx from "classnames";
import { isMobileView } from "@binders/ui-kit/lib/helpers/rwd";
import { isPortrait } from "../../../../../utils/viewport";
import { isPublicationItem } from "@binders/client/lib/clients/repositoryservice/v3/validation";
import { makeSubstringBold } from "@binders/ui-kit/lib/helpers/dom";
import { useActiveAccountId } from "../../../../../stores/hooks/account-hooks";
import { useActiveViewableTitle } from "../../../../../stores/hooks/binder-hooks";
import { useCaptureDisplayEvent } from "./hooks";
import { useCurrentUser } from "../../../../../stores/hooks/user-hooks";
import { useTranslation } from "@binders/client/lib/react/i18n";
import "./ReadConfirmationChunkPart.styl";

export type ReadConfirmationChunkPartProps = ContentChunkProps;

export const ReadConfirmationChunkPart = (props: ReadConfirmationChunkPartProps) => {
    const { t } = useTranslation();
    const user = useCurrentUser();
    const accountId = useActiveAccountId();
    const buttonRef = useRef<HTMLDivElement>(null);

    const documentName = useActiveViewableTitle();
    const [isRead, setIsRead] = React.useState(false);

    const frontendEventProps = useMemo(() => ({
        userId: user.id,
        binderId: props.binderId,
        publicationId: isPublicationItem(props.viewable) ? props.viewable.id : undefined,
        language: props.language,
    }), [props.binderId, props.viewable, user.id, props.language]);

    useCaptureDisplayEvent(props.isActive, frontendEventProps);

    const onClickConfirm = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsRead(true);
        import("canvas-confetti").then(({ default: confetti }) => { // dynamic import to avoid bundle size increase
            const buttonRect = buttonRef.current?.getBoundingClientRect();
            const origin = buttonRect ?
                {
                    x: (buttonRect.x + buttonRect.width / 2) / window.innerWidth,
                    y: (buttonRect.y + 50) / window.innerHeight,
                } :
                undefined;
            confetti({ origin, spread: 70 });
        });
        captureFrontendEvent(ReaderEvent.DocumentReadConfirmationClicked, frontendEventProps);
        APIMultiInsertUserAction([{
            accountId,
            userActionType: UserActionType.DOCUMENT_READ_CONFIRMED,
            userId: user.id,
            data: {
                binderId: props.binderId,
                ...(isPublicationItem(props.viewable) ? { publicationId: props.viewable.id } : {}),
            }
        }], accountId);
    }, [accountId, frontendEventProps, props.binderId, props.viewable, user.id]);

    const portrait = isPortrait();
    const hasCenterPosition = useMemo(() => isMobileView() && portrait, [portrait]);

    const positionCheckIcon = useCallback((checkIcon: React.ReactNode, mediaModuleTailslotRef: HTMLDivElement) => {
        return hasCenterPosition ? ReactDOM.createPortal(checkIcon, mediaModuleTailslotRef) : checkIcon;
    }, [hasCenterPosition]);

    return (
        <VerticalCenter
            isVerticallyCentered={true}
            minPadding={props.minPadding}
            imageViewportHeight={props.imageViewportDims.height}
            className="chunk-html"
        >
            <div className="chunk-read-confirmation" {...{ [READ_CONFIRMATION_CHUNK_DATAPROP]: true }}>
                {isRead && props.mediaModuleTailslotRef && positionCheckIcon(
                    <div className={cx(
                        "chunk-read-confirmation-checkIcon",
                        {
                            "chunk-read-confirmation-checkIcon--hasCenterPosition": hasCenterPosition,
                        }
                    )}>
                        <Icon name="check" />
                        <div className="chunk-read-confirmation-checkIcon-curtain"></div>
                    </div>,
                    props.mediaModuleTailslotRef
                )}
                <h2>
                    {isRead ? t(TK.ReadConfirmation_Post_Title) : t(TK.ReadConfirmation_Pre_Title)}
                </h2>
                <span className="chunk-read-confirmation-paragraph">
                    {makeSubstringBold(
                        isRead ? t(TK.ReadConfirmation_Post_Body, { documentName }) : t(TK.ReadConfirmation_Pre_Body1, { documentName }),
                        `"${documentName}"`,
                    )}
                </span>
                {!isRead && (
                    <span className="chunk-read-confirmation-paragraph">
                        {t(TK.ReadConfirmation_Pre_Body2)}
                    </span>
                )}
                <Button
                    text={isRead ? `${t(TK.General_Confirmed)}!` : t(TK.ReadConfirmation_Cta)}
                    onClick={onClickConfirm}
                    isEnabled={!isRead}
                    ref={buttonRef}
                    data-testid="read-confirmation-button"
                />
            </div>
        </VerticalCenter>
    );
}
