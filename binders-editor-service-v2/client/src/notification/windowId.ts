import { v4 as uuidv4 } from "uuid";

const windowId = uuidv4();

export const getWindowId = (): string => windowId;