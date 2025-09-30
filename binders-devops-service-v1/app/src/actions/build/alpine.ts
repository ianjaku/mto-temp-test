

function getExtraApkPackages(serviceFolder: string): string[] {
    switch (serviceFolder) {
        case "binders-screenshot-service-v1":
        case "binders-image-service-v1": {
            return [
                "gifsicle ffmpeg imagemagick imagemagick-heic"
            ];
        }
        case "binders-repository-service-v3": {
            return [
                "bash unifont"
            ]
        }
        //         "wkhtmltopdf",
        //         "xvfb",
        //         "ttf-dejavu",
        //         "ttf-droid",
        //         "ttf-freefont",
        //         "ttf-liberation"
        //     ];
        // }
        default:
            return [];
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function installExtraApkPackages(serviceFolder: string) {
    return getExtraApkPackages(serviceFolder).map(
        extra => `RUN apk add --no-cache ${extra}`
    )
}
