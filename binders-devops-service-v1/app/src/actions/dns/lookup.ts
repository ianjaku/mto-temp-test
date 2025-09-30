import { lookup as nodeLookup } from "dns";

export enum AddressFamily {
    IPV4 = 4,
    IPV6 = 6
}

export const lookup = (hostname: string, family: AddressFamily): Promise<string> => {
    return new Promise( (resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        nodeLookup(hostname, {family}, (err, address, familyresult) => {
            if (err) {
                reject(err);
            }
            resolve(address);
        });
    });
};