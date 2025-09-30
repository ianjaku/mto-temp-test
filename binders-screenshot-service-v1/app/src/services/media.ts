export type Media = Record<string, { format: number; dimensions: string }>;


export function getDimensions(meta: Media, formatName: string): { height: number, width: number } {
    const { dimensions } = meta[formatName];
    if (!dimensions) {
        throw new Error(`Could not determine dimensions for format ${formatName}`);
    }
    const [width, height] = dimensions
        .split("x")
        .map((s: string) => s.trim())
        .map((s: string) => Math.floor(Number.parseInt(s, 10)));
    return { height, width };
}
