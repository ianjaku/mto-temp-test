// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseStyleProps {}

export class BaseStyle<T extends BaseStyleProps> {
    constructor(private readonly props: T) {}

    getProps(): T {
        return this.props;
    }
}
