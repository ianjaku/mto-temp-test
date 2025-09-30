/**
 * to lighten use positive percent, to darken negative
 */
export function shadeHexColor(hexColor: string, percent: number): string {
    let r = parseInt(hexColor.substring(1, 3), 16);
    let g = parseInt(hexColor.substring(3, 5), 16);
    let b = parseInt(hexColor.substring(5, 7), 16);
    r = r * (100 + percent) / 100;
    g = g * (100 + percent) / 100;
    b = b * (100 + percent) / 100;
    r = Math.min(255, Math.round(r));
    g = Math.min(255, Math.round(g));
    b = Math.min(255, Math.round(b));
    const rr = (r.toString(16).length == 1) ? "0" + r.toString(16) : r.toString(16);
    const gg = (g.toString(16).length == 1) ? "0" + g.toString(16) : g.toString(16);
    const bb = (b.toString(16).length == 1) ? "0" + b.toString(16) : b.toString(16);
    return `#${rr}${gg}${bb}`;
}
