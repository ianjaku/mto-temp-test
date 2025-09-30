
import * as fs from "fs";

export const listDirectory = (directory: string): Promise<string[]> => {
    return new Promise( (resolve, reject) => {
        fs.readdir(directory, (err, entries) => {
            if (err) {
                return reject(err);
            }
            resolve(entries);
        });
    });
};

export const realpath = (entry: string): Promise<string> => {
    return new Promise( (resolve, reject) => {
        fs.realpath(entry, (err, path) => {
            if (err) {
                return reject(err);
            }
            resolve(path);
        });
    });
};

export type FileContent = string;

export const loadFile = async (path: string): Promise<FileContent> => {
    return new Promise<FileContent>( (resolve, reject) => {
        fs.readFile(path, (err, data) => {
            if (err) {
                reject(err);
                return;
            }
            try {
                return resolve(data.toString());
            } catch (err) {
                reject(err);
            }
        });
    });
};

export const dumpFile = async (path: string, content: FileContent): Promise<void> => {
    return new Promise<void>( (resolve, reject) => {
        fs.writeFile(path, content, err => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};

export const copyFile = async (fromPath: string, toPath: string): Promise<void> => {
    return new Promise<void> ( (resolve, reject) => {
        fs.copyFile(fromPath, toPath, err => {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
};

export const isDirectory = async (entry: string): Promise<boolean> => {
    return new Promise<boolean> ( (resolve, reject) => {
        fs.lstat(entry, (err, stat) => {
            if (err) {
                reject(err);
            } else {
                resolve(stat.isDirectory());
            }
        });
    });

}

export const exists = async (entry: string): Promise<boolean> => {
    return new Promise<boolean> ( resolve => {
        fs.access(entry, fs.constants.F_OK, (err) => {
            resolve(!err);
        })
    })
}