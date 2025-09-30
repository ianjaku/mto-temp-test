import * as sharp from "sharp";

type ResizeSpec = { height: number, width: number }

interface ResizeOutput {
    height: number
    path: string
    size: number
    width: number
}

export async function resizeImage(originalImagePath: string, resizeSpec: ResizeSpec): Promise<ResizeOutput> {
    const { height, width } = resizeSpec;
    const outputPath = `${originalImagePath}-${width}x${height}`;
    const data = await sharp(originalImagePath)
        .clone()
        .resize(width, height)
        .withMetadata()
        .toFile(outputPath)
    return {
        path: outputPath,
        ...data
    }
}
