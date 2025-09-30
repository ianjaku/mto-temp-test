import * as React from "react";
import cx from "classnames";

export interface ISeparatorProps extends React.HTMLProps<HTMLInputElement> {
    dotted?: boolean;
}

const Separator: React.FC<ISeparatorProps> = (props: ISeparatorProps) => {
    const { dotted } = props;
    return <div className={cx("separator", { "separator--dotted": dotted })} />;
};

export default Separator;