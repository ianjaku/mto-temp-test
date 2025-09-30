import { Response } from "express";

export interface ItemStorage {
    addItem(itemName: string, localFile: string): Promise<void>;
    sendFileWithExpress(itemName: string, response: Response): Promise<void>;
}