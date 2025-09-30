import * as React from "react";
import { ComponentType, FC } from "react";

export const withHooks = <Props, UseProps extends Record<string, unknown>>(
    Comp: ComponentType<Props>,
    getUseProps: (props: Omit<Props, keyof UseProps>) => UseProps
): FC<Omit<Props, keyof UseProps>> => {
    return (props: Omit<Props, keyof UseProps>) => {
        const allProps = { ...props, ...getUseProps(props) } as Props;
        return <Comp {...allProps} />
    }
}

