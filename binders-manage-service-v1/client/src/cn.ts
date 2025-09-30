import cx from "classnames";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: unknown[]) {
    return twMerge(cx(inputs));
}
