import "@tiptap/core";

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        blockInfo: {
            setBlockInfo: () => ReturnType;
            setBlockWarning: () => ReturnType;
        };
    }
}
