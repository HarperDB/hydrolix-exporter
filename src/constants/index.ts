import { LogLevel } from '../types/graphql.js';

export const EXPORTER_CONFIG_KEY = 'hydrolix_config';
export const CONFIG_REFRESH_MS = 60000; // 60 seconds
export const DEFAULT_EXPORTER_CONFIG = {
	logLevel: LogLevel.All,
	pollInterval: 60,
	logIngestPercentage: 1,
};

export const HYDROLIX_ROUTES = {
	LOGIN: '/config/v1/login',
	INGEST: '/ingest/event',
	PROJECTS: (orgId: string) => `/config/v1/orgs/${orgId}/projects`,
	TABLES: (orgId: string, projId: string) => `/config/v1/orgs/${orgId}/projects/${projId}/tables`,
	TRANSFORMS: (orgId: string, projId: string, tableId: string) =>
		`/config/v1/orgs/${orgId}/projects/${projId}/tables/${tableId}/transforms`,
};
