
export const isEquals = (o: Partial<Equals>): o is Equals =>
    typeof o?.equals === "function";

interface Equals {
    equals(other: unknown): boolean;
}
