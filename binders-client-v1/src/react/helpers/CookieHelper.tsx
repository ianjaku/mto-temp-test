export default class CookieHelper {

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    setCookie(name : string, value, expirationDays : number) : void {
        const date = new Date();
        date.setTime(date.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
        const expires = `expires=${date.toUTCString()}`;

        document.cookie = `${name}=${value};${expires};path=/`;
    }

    getCookie(name : string) : string {
        const cookieName = name + "=";
        const cookieList = document.cookie.split(";");

        for(let i = 0; i < cookieList.length; i++) {
            let cookie = cookieList[i];
            while (cookie.charAt(0) == " ") {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(cookieName) == 0) {
                return cookie.substring(cookieName.length, cookie.length);
            }
        }
        return undefined;
    }
}