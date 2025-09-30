import { EntityNotFound } from "../../model";
import { TranslationKeys as TK } from "../../../i18n/translations";
import i18n from "../../../i18n";


export class UserNotFound extends EntityNotFound {
    constructor(id: string) {
        super(i18n.t(TK.User_NoUserWithIdError, { id }));
        Object.setPrototypeOf(this, UserNotFound.prototype);  // ES5 >= requirement
    }
}
