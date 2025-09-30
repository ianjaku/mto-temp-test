const ManualToRoutes = {
    BROWSE: "/browse",
    SEARCH: "/search",
    RESET_PASSWORD: "/reset-password",
    RESEND_RESET:"/reset-resend",
    RESEND_INVITE: "/invite-resend",
    LAUNCH: "/launch",
    PREVIEW: "/preview",
    READ: "/read",
    USER_SETTINGS: "/usersettings",
    ROUTE_401: "/401",
    INVITE: "/invite",
    RESET: "/reset",
    ASSETS: "/assets",
    LOGIN: "/login",
    LOGOUT: "/logout",
    SSO: "/sso",
    NOT_FOUND: "/content-not-found",
    STOPIMPERSONATION: "/stopimpersonation",
} as const;

export const READER_ROUTES_PREFIXES = Object.values(ManualToRoutes)
    .reduce((collector, route) => {
        const [, prefix] = route.split("/");
        return collector.add(prefix);
    }, new Set<string>());

export default ManualToRoutes;