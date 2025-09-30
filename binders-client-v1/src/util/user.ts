export function isManualToLogin(login: string): boolean {
    return login.endsWith("@manual.to");
}

export const isNotManualToLogin = (login: string): boolean => !isManualToLogin(login);
