import * as React from "react";
import { AccountCreate, AccountEdit } from "./pages/accounts/form";
import { CustomerCreate, CustomerEdit } from "./pages/customers/form";
import { Route, Router, browserHistory } from "react-router";
import { AccountAdmins } from "./pages/accounts/admins";
import { AccountFeatures } from "./pages/accounts/features";
import { AccountMembers } from "./pages/accounts/members";
import { AccountsOverview } from "./pages/accounts/overview";
import { AlertCreate } from "./pages/alerts/create";
import { AlertDelete } from "./pages/alerts/delete";
import { AlertEdit } from "./pages/alerts/edit";
import { AlertsOverview } from "./pages/alerts/overview";
import { BrandingEdit } from "./pages/branding/edit";
import { BrandingsOverview } from "./pages/branding/overview";
import { CustomerAccounts } from "./pages/customers/accounts";
import { CustomersOverview } from "./pages/customers/overview";
import { IndexRedirect } from "react-router";
import Layout from "./layout";
import { MockedEmails } from "./pages/dev/emails";
import { PlgBootstrap } from "./pages/plg/bootstrap";
import { ReactQueryProvider } from "./react-query";
import { UserCreate } from "./pages/users/usercreate";
import { UserEdit } from "./pages/users/useredit";
import { UserMemberships } from "./pages/users/memberships";
import { UserPassword } from "./pages/users/password";
import { UsersOverview } from "./pages/users/overview";

export const App = () => (
    <ReactQueryProvider>
        <Router history={browserHistory}>
            <Route path="/" component={Layout}>
                <IndexRedirect to="/accounts/overview" />
                <Route path="/dev/emails" component={MockedEmails} />
                <Route path="/customers">
                    <IndexRedirect to="/customers/overview" />
                    <Route path="/customers/create" component={CustomerCreate} />
                    <Route path="/customers/overview" component={CustomersOverview} />
                    <Route path="/customers/:customerId" component={CustomerEdit} />
                    <Route path="/customers/:customerId/accounts" component={CustomerAccounts} />
                </Route>
                <Route path="/users">
                    <IndexRedirect to="/users/overview" />
                    <Route path="/users/create" component={UserCreate} />
                    <Route path="/users/overview" component={UsersOverview} />
                    <Route path="/users/:userId" component={UserEdit} />
                    <Route path="/users/:userId/password" component={UserPassword} />
                    <Route path="/memberships/:userId" component={UserMemberships} />
                </Route>
                <Route path="/accounts">
                    <IndexRedirect to="/accounts/overview" />
                    <Route path="/accounts/create" component={AccountCreate} />
                    <Route path="/accounts/overview" component={AccountsOverview} />
                    <Route path="/accounts/:accountId" component={AccountEdit} />
                    <Route path="/accounts/:accountId/members" component={AccountMembers} />
                    <Route path="/accounts/:accountId/admins" component={AccountAdmins} />
                    <Route path="/accounts/:accountId/features" component={AccountFeatures} />
                </Route>
                <Route path="/branding">
                    <IndexRedirect to="/branding/edit" />
                    <Route path="/branding/edit" component={BrandingsOverview} />
                    <Route path="/branding/edit/:accountId/:brandingId" component={BrandingEdit} />
                    <Route path="/branding/:accountId/new" component={BrandingEdit} />
                </Route>
                <Route path="/alerts">
                    <IndexRedirect to="/alerts/overview" />
                    <Route path="/alerts/overview" component={AlertsOverview} />
                    <Route path="/alerts/create" component={AlertCreate} />
                    <Route path="/alerts/edit/:alertId" component={AlertEdit} />
                    <Route path="/alerts/delete/:alertId" component={AlertDelete} />
                </Route>
                <Route path="/plg" component={PlgBootstrap} />
            </Route>
        </Router>
    </ReactQueryProvider>
)
