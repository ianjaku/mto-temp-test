import * as React from "react";
import { getAcceptVisualsString } from "@binders/client/lib/clients/imageservice/v1/visuals";

interface VisualInputProps {
    onChange: React.ChangeEventHandler;
}

const VisualInput = React.forwardRef<HTMLInputElement, VisualInputProps>(({ onChange }, ref) => {
    return (
        <input
            ref={ref}
            type="file"
            name={"visual"}
            onChange={onChange}
            multiple
            style={{ display: "none", position: "absolute" }}
            accept={getAcceptVisualsString()}
        />
    );
});

export default VisualInput;