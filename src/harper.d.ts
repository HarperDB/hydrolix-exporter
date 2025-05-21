declare module 'harperdb';

declare global {
    type Logger = {
        info: (...args: any[]) => void;
        warn: (...args: any[]) => void;
        error: (...args: any[]) => void;
    };

    let logger: Logger;
}