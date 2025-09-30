import { validateStringInput } from "@binders/client/lib/clients/validation";

export const validateDisplayName = (name): string[] => {
    return [
        ...validateStringInput(name),
        ...(name.length > 0 ? [] : ["Display name cannot be empty"])
    ];
}