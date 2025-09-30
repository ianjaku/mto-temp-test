export function mergeGroupNames(names: string[], and: string) {
    if (!names.length) return "";
    if (names.length === 1) return names.at(0);
    if (names.length === 2) return `${names.at(0)} ${and} ${names.at(1)}`;
    return `${names.slice(0, -1).join(", ")} ${and} ${names.at(-1)}`
}

