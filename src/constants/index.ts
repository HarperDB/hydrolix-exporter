import { LogLevel } from '../types/graphql.js';

export const CONFIG_REFRESH_MS = 60000; // 60 seconds
export const DEFAULT_EXPORT_CONFIG = {
	logLevel: LogLevel.All,
	includeSystemInfo: true,
	pollInterval: 60,
	logIngestPercentage: 1,
};

export enum HYDROLIX_ROUTES {
	LOGIN = '/config/v1/login',
	INGEST = '/ingest/event',
}
