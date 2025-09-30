const defaultPrefix = () => `[stdout-main ${new Date().toLocaleString()}]: `;

// eslint-disable-next-line no-console
export const log = (msg: unknown = "", prefix?: string): void => console.log( (prefix === undefined ? defaultPrefix() : prefix), msg);

export default log;