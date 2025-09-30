import { immutableStateFromKeys, updateWebDataState } from "@binders/client/lib/webdata/flux";
import Dispatcher from "@binders/client/lib/react/flux/dispatcher";
import { ReduceStore } from "flux/utils";

export const KEY_ACCOUNT_USERS = "account-users";
export const KEY_ACCOUNT_USERIMPORTACTIONS = "account-userimportactions";
export const KEY_ACCOUNT_WHITELISTEDEMAILS = "account-whitelistedemails";
export const KEY_NEW_WHITELISTEDEMAIL = "account-whitelistedemails-new";
export const KEY_USERS_IMPORTED = "users-imported";
export const KEY_UPDATE_USERDATA = "accountusers-update";
export const KEY_UPDATE_WHITELISTEDEMAIL_ACTIVE = "account-update-whitelistedemail-active"
export const ACTION_LIFT_USERS_ADD_NEW = "lift_users_add_new";

const ALL_MANAGED_KEYS = [
    KEY_ACCOUNT_USERS,
    KEY_ACCOUNT_USERIMPORTACTIONS,
    KEY_ACCOUNT_WHITELISTEDEMAILS,
];

function liftUsersAddNew(state, newUsers) {
    const currentUsersWD = state.get(KEY_ACCOUNT_USERS);
    const updatedUsersWD = currentUsersWD.lift(currentUsers => {
        const currentUserIds = new Set(currentUsers.map(user => user.id));
        const nonExistingUsers = newUsers.filter(newUser => !currentUserIds.has(newUser.id));
        return currentUsers.concat(nonExistingUsers);
    });
    return state.set(KEY_ACCOUNT_USERS, updatedUsersWD);
}

function liftImportActionsAddNew(state, newImportActions) {
    const currentImportActionsWD = state.get(KEY_ACCOUNT_USERIMPORTACTIONS);
    const updatedImportActions = currentImportActionsWD.lift(currentActions => [...newImportActions, ...currentActions]);
    return state.set(KEY_ACCOUNT_USERIMPORTACTIONS, updatedImportActions);
}

const updateStateWithUserImport = (state, importAction) => {
    const { userImportResults, importDate } = importAction;
    const importedUsers = userImportResults
        .filter(r => !!r.user)
        .map(r => ({
            created: importDate,
            ...r.user,
        }));
    const updatedState = liftUsersAddNew(state, importedUsers);
    return liftImportActionsAddNew(updatedState, [importAction]);
}

class UserStore extends ReduceStore {

    // boilerplate

    getInitialState() {
        return immutableStateFromKeys(ALL_MANAGED_KEYS);
    }

    reduce(state, action) {
        switch (action.type) {
            case KEY_UPDATE_USERDATA: {
                const currentUsersWD = state.get(KEY_ACCOUNT_USERS);
                const updatedUsersWD = currentUsersWD.lift(currentUsers =>
                    currentUsers.map(u => {
                        if (u.id === action.body.user.id) {
                            return action.body.user;
                        }
                        return u;
                    })
                );
                return state
                    .set(KEY_ACCOUNT_USERS, updatedUsersWD)
            }
            case KEY_USERS_IMPORTED:
                return updateStateWithUserImport(state, action.body);
            case ACTION_LIFT_USERS_ADD_NEW:
                return liftUsersAddNew(state, action.body);
            case KEY_NEW_WHITELISTEDEMAIL: {
                const emails = state.get(KEY_ACCOUNT_WHITELISTEDEMAILS);
                const newEmails = emails.lift(data => ([...data, action.body]));
                return state.set(KEY_ACCOUNT_WHITELISTEDEMAILS, newEmails);
            }
            case KEY_UPDATE_WHITELISTEDEMAIL_ACTIVE: {
                const emails = state.get(KEY_ACCOUNT_WHITELISTEDEMAILS);
                const newEmails = emails.lift(data => {
                    return data.map(d => {
                        if (d.id === action.body.id) {
                            return { ...d, active: action.body.active };
                        }
                        return d;
                    })
                });
                return state.set(KEY_ACCOUNT_WHITELISTEDEMAILS, newEmails);
            }
            default:
                return updateWebDataState(state, action, ALL_MANAGED_KEYS);
        }
    }


    accountUsers() {
        return this.getState().get(KEY_ACCOUNT_USERS);
    }

    accountUserImportActions() {
        return this.getState().get(KEY_ACCOUNT_USERIMPORTACTIONS);
    }

    accountWhitelistedEmails() {
        return this.getState().get(KEY_ACCOUNT_WHITELISTEDEMAILS);
    }

}

const instance = new UserStore(Dispatcher);
export default instance;

