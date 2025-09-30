import { Netmask } from "netmask";
import { any } from "ramda";

export class MultiCIDR {

    private masks: Netmask[];

    constructor(cidrs: string[]) {
        this.masks = cidrs.map(cidr => new Netmask(cidr));
    }

    contains(ip: string): boolean {
        return any(m => m.contains(ip), this.masks);
    }
}