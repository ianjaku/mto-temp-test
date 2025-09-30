import * as React from "react";

const strokeStyle: React.CSSProperties = {
    stroke: "none",
    strokeDasharray: "none",
    strokeLinecap: "butt",
    strokeLinejoin: "miter",
    strokeMiterlimit: 10,
    fillRule: "nonzero",
    opacity: 1,
    strokeWidth: 1,
    fill: "black",
}

const strokeNoneStyle: React.CSSProperties = {
    strokeWidth: 0,
    fill: "none",
}

export const NoImageIcon: React.FC<{
    width?: string;
    height?: string;
    opacity?: number;
}> = ({ width, height, opacity }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            version="1.1"
            width="256"
            height="256"
            viewBox="0 0 256 256"
            className="hc-icon-no-image"
            style={{ width, height, opacity }}
        >
            <desc>Created with Fabric.js 1.7.22</desc>
            <g transform="translate(128 128) scale(0.72 0.72)">
                <g
                    style={{ ...strokeStyle, ...strokeNoneStyle }}
                    transform="translate(-175.05 -175.05000000000004) scale(3.89 3.89)"
                >
                    <path
                        style={strokeStyle}
                        d="M 88.643 90 c -0.257 0 -0.515 -0.099 -0.71 -0.296 l -87.286 -88 C 0.258 1.312 0.261 0.679 0.653 0.29 S 1.68 -0.096 2.067 0.296 l 87.286 88 c 0.389 0.392 0.387 1.025 -0.006 1.414 C 89.151 89.903 88.897 90 88.643 90 z"
                        transform=" matrix(1 0 0 1 0 0) "
                        strokeLinecap="round"
                    />
                    <ellipse
                        style={strokeStyle}
                        cx="75.889"
                        cy="29.006"
                        rx="3.309"
                        ry="3.336"
                        transform=" matrix(1 0 0 1 0 0) "
                    />
                    <path
                        style={strokeStyle}
                        d="M 75.524 76.774 H 9.761 C 4.379 76.774 0 72.363 0 66.94 V 26.409 c 0 -5.422 4.379 -9.833 9.761 -9.833 h 4.769 c 0.831 0 1.649 -0.145 2.43 -0.431 c 0.516 -0.189 1.092 0.077 1.283 0.596 c 0.189 0.519 -0.078 1.093 -0.596 1.283 c -1.002 0.366 -2.051 0.552 -3.117 0.552 H 9.761 C 5.481 18.576 2 22.09 2 26.409 V 66.94 c 0 4.319 3.481 7.834 7.761 7.834 h 65.763 c 0.553 0 1 0.447 1 1 S 76.077 76.774 75.524 76.774 z"
                        transform=" matrix(1 0 0 1 0 0) "
                        strokeLinecap="round"
                    />
                    <path
                        style={strokeStyle}
                        d="M 45 65.961 c -11.469 0 -20.799 -9.403 -20.799 -20.961 c 0 -5.597 2.163 -10.86 6.089 -14.819 c 0.389 -0.392 1.022 -0.396 1.414 -0.006 c 0.392 0.389 0.395 1.022 0.006 1.414 c -3.553 3.582 -5.509 8.345 -5.509 13.411 c 0 10.455 8.433 18.961 18.799 18.961 c 5.02 0 9.739 -1.972 13.29 -5.551 c 0.389 -0.393 1.022 -0.394 1.414 -0.006 c 0.393 0.389 0.395 1.022 0.006 1.414 C 55.781 63.779 50.557 65.961 45 65.961 z"
                        transform=" matrix(1 0 0 1 0 0) "
                        strokeLinecap="round"
                    />
                    <path
                        style={strokeStyle}
                        d="M 87.339 73.116 c -0.202 0 -0.405 -0.061 -0.582 -0.188 c -0.449 -0.322 -0.552 -0.947 -0.229 -1.396 C 87.491 70.191 88 68.603 88 66.94 V 26.409 c 0 -4.319 -3.481 -7.833 -7.762 -7.833 H 75.47 c -3.377 0 -6.464 -1.864 -8.056 -4.865 l -1.439 -2.716 c -1.603 -3.023 -4.71 -4.902 -8.108 -4.902 H 32.134 c -2.68 0 -5.219 1.175 -6.968 3.224 c -0.359 0.419 -0.99 0.469 -1.41 0.111 c -0.42 -0.359 -0.47 -0.99 -0.111 -1.41 c 2.129 -2.494 5.224 -3.925 8.489 -3.925 h 25.732 c 4.141 0 7.925 2.286 9.876 5.965 l 1.439 2.715 c 1.243 2.345 3.653 3.802 6.288 3.802 h 4.769 c 5.383 0 9.762 4.411 9.762 9.833 V 66.94 c 0 2.084 -0.639 4.075 -1.848 5.759 C 87.957 72.972 87.65 73.116 87.339 73.116 z"
                        transform=" matrix(1 0 0 1 0 0) "
                        strokeLinecap="round"
                    />
                    <path
                        style={strokeStyle}
                        d="M 64.436 49.83 c -0.063 0 -0.127 -0.006 -0.19 -0.019 c -0.542 -0.104 -0.897 -0.629 -0.792 -1.171 c 0.229 -1.189 0.346 -2.415 0.346 -3.641 c 0 -10.455 -8.434 -18.961 -18.799 -18.961 c -1.266 0 -2.53 0.127 -3.758 0.378 c -0.541 0.11 -1.069 -0.238 -1.18 -0.779 c -0.111 -0.541 0.238 -1.069 0.779 -1.18 C 42.201 24.18 43.6 24.039 45 24.039 c 11.469 0 20.799 9.403 20.799 20.961 c 0 1.353 -0.129 2.705 -0.383 4.02 C 65.324 49.498 64.905 49.83 64.436 49.83 z"
                        transform=" matrix(1 0 0 1 0 0) "
                        strokeLinecap="round"
                    />
                </g>
            </g>
        </svg>
    )
}

export default NoImageIcon;

