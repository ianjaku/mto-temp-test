// eslint-disable-next-line @typescript-eslint/no-var-requires
const exec = require("child-process-promise").exec;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shellescape = require("shell-escape");

export const convertImageToDifferentFormat = async (path: string, format: string): Promise<string> => {
    const pathParts = path.split(".");
    const pathWoExtension = pathParts.join("");
    const jpgPath = `${pathWoExtension}.${format}`;
    try {
        const imageMagickCmd = shellescape(["magick", path, jpgPath]);
        await exec(imageMagickCmd);
        return jpgPath;
    } catch (error) {
        throw new Error(`Failed to convert image ${path} to ${format} format`, { cause: error });
    }
};
