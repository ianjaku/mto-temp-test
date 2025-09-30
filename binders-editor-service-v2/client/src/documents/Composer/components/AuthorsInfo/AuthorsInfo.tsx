import * as React from "react";
import Tooltip, {
    TooltipPosition,
    hideTooltip,
    showTooltip
} from "@binders/ui-kit/lib/elements/tooltip/Tooltip";
import Button from "@binders/ui-kit/lib/elements/button";
import { Container } from "flux/utils";
import DocumentStore from "../../../store";
import Icon from "@binders/ui-kit/lib/elements/icons";
import Modal from "@binders/ui-kit/lib/elements/modal";
import { TFunction } from "@binders/client/lib/i18n";
import { TranslationKeys as TK } from "@binders/client/lib/react/i18n/translations";
import { User } from "@binders/client/lib/clients/userservice/v1/contract";
import cx from "classnames";
import { difference } from "ramda";
import { fixES5FluxContainer } from "@binders/client/lib/react/fluxES5Converter";
import { getUsers } from "../../../../shared/DeletedItemNotification/actions";
import { updateAuthors } from "../../../actions";
import { withTranslation } from "@binders/client/lib/react/i18n";
import "./AuthorsInfo.styl";

interface IAuthorsInfoProps {
    binderAuthorIds: string[];
    t: TFunction,
}

interface IAuthorsInfoState {
    authorIds: string[];
    usersExtended: { [id: string]: User };
    isAllAuthorsModalShown: boolean;
}

class AuthorsInfo extends React.Component<IAuthorsInfoProps, IAuthorsInfoState> {

    triggerButtonTooltipRef: Tooltip;

    constructor(props: IAuthorsInfoProps) {
        super(props);
    }

    static getStores() {
        return [DocumentStore];
    }

    static calculateState(prevState: IAuthorsInfoState) {
        const authors = DocumentStore.getAuthors();
        return {
            authorIds: authors,
            usersExtended: prevState ? prevState.usersExtended : {}
        };
    }

    async getUserDetails(authors: string[]) {
        const { usersExtended = {} } = this.state;
        const userIdsExtended = Object.keys(usersExtended);
        const idsToExtend = difference(authors, userIdsExtended);
        const users = await getUsers(idsToExtend);
        const usersMap = users.reduce((acc, u) => {
            return { ...acc, [u.id]: u }
        }, {} as Record<string, User>);
        this.setState({
            usersExtended: { ...usersExtended, ...usersMap },
        })
    }

    hideAllAuthorsModal() {
        this.setState({
            isAllAuthorsModalShown: false
        });
    }

    showAllAuthorsModal() {
        this.setState({
            isAllAuthorsModalShown: true
        });
    }

    renderAuthorsNames(usersIds: string[], orientation: "horizontal" | "vertical") {
        const { usersExtended = {} } = this.state;
        const extendedUsersIds = Object.keys(usersExtended);
        return usersIds.map(
            (author, index) => {
                const login = usersExtended[author]?.login;
                return login && <span
                    className={cx({
                        "isGreyedOut": login.includes("@manual.to"),
                        "isVertical": orientation === "vertical",
                    })}
                    key={login}
                    title={login}>
                    {orientation === "horizontal" ? "\u00A0" : ""}{`${usersExtended[author].displayName}${index < extendedUsersIds.length - 1 ? ", " : ""}`}
                </span>
            }
        )
    }


    renderAllAuthorsModal() {
        const { authorIds: usersIds } = this.state;
        const { t } = this.props;
        return <Modal
            onHide={this.hideAllAuthorsModal.bind(this)}
            title={t(TK.Edit_Authors)}
            buttons={[
                <Button onClick={this.hideAllAuthorsModal.bind(this)} text={t(TK.General_Close)} />
            ]}
            classNames="composer-authors-modal"
        >
            {this.renderAuthorsNames(usersIds, "vertical")}
        </Modal>
    }

    async componentDidMount() {
        const { authorIds = [] } = this.state;
        const { binderAuthorIds } = this.props;
        const authors = authorIds?.length ? authorIds : binderAuthorIds;
        updateAuthors(authors)
        this.getUserDetails(authors);
    }
    componentWillUnmount() {
        updateAuthors([]);
    }

    async componentDidUpdate(_: IAuthorsInfoProps, prevState: IAuthorsInfoState) {
        const { authorIds = [] } = this.state;
        if (prevState.authorIds.length !== this.state.authorIds.length) {
            this.getUserDetails(authorIds);
        }
    }

    showTooltip = (e) => {
        showTooltip(e, this.triggerButtonTooltipRef, TooltipPosition.BOTTOM);
    }

    hideTooltip = (e) => {
        hideTooltip(e, this.triggerButtonTooltipRef);
    }

    render() {
        const { usersExtended = {}, isAllAuthorsModalShown } = this.state;
        const extendedUsersIds = Object.keys(usersExtended);
        return (
            <div className="composer-authors">
                {extendedUsersIds.length > 0 ?
                    <>
                        <label
                            className="composer-authors-triggerBtn"
                            onClick={this.showAllAuthorsModal.bind(this)}
                            onMouseEnter={this.showTooltip}
                            onMouseLeave={this.hideTooltip}
                        >
                            <Icon
                                name="person_edit"
                            />
                        </label>
                        {isAllAuthorsModalShown && this.renderAllAuthorsModal()}
                        <Tooltip ref={ref => { this.triggerButtonTooltipRef = ref; }} message={this.props.t(TK.Edit_Authors_Tooltip)} />
                    </> :
                    " "}
            </div>
        )
    }
}

const instance = Container.create(fixES5FluxContainer(AuthorsInfo));
export default withTranslation()(instance);
