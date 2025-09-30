import { BaseStyle, BaseStyleProps } from "./base";
import { ReaderCssProps } from "./reader";
import { RoutingServiceContract } from "@binders/client/lib/clients/routingservice/v1/contract";

export interface BaseStyleRepository<T extends BaseStyleProps> {
    get(key: string): Promise<BaseStyle<T>>;
    set(key: string, baseStyleProps: T): Promise<void>;
}

export class APIReaderStyleRepository implements BaseStyleRepository<ReaderCssProps> {
    constructor(private readonly defaultProps: ReaderCssProps, private readonly contract: RoutingServiceContract) {
    }

    get(key: string): Promise<BaseStyle<ReaderCssProps>> {
        return this.contract.getBrandingForReaderDomain(key)
            .then(branding => {
                const props = Object.assign({}, this.defaultProps, branding.stylusOverrideProps);
                return new BaseStyle<ReaderCssProps>(props);
            });
    }

    set(key: string, baseStyleProps: ReaderCssProps): Promise<void> {
        return this.contract.getBrandingForReaderDomain(key)
            .then(branding => {
                branding.stylusOverrideProps = baseStyleProps;
                return this.contract.setBrandingForReaderDomain(key, branding);
            });
    }

}