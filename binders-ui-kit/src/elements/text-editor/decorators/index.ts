import * as Link from "./link";
import { CompositeDecorator, DraftDecorator } from "draft-js";

const linkd = {
    component: Link.component,
    strategy: Link.strategy,
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const buildDecorator = (decorators: DraftDecorator[] = []) => {
    return new CompositeDecorator(
        [
            ...decorators,
            linkd,
        ]
    )
};

export const linkDecorator = buildDecorator();
