export class WhitelistedEmail {
    constructor(
        readonly id: string,
        readonly accountId: string,
        readonly domain: string,
        readonly pattern: string,
        readonly active: boolean) {
    }
}