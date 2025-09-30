
/**
 * Gets thrown when all video play 
 */
export class FatalVideoError extends Error {
    constructor(
        public readonly message: string,
        public readonly src?: string,
        public readonly errorCode?: number, // MediaError
        public readonly stack?: string,
    ) {
        super(message);
    }
}
