import { databases } from 'harperdb';
import type { LogExportConfiguration } from '../types/graphql.js';

export class ExportConfig extends databases.LogsExporter.LogExportConfiguration {
	put(payload: LogExportConfiguration) {
		if (payload.pollInterval < 1 || payload.pollInterval > 3600) {
			throw new Error('pollInterval must be between 1 and 3600 seconds');
		}

		if (payload.logIngestPercentage < 0 || payload.logIngestPercentage > 1) {
			throw new Error('logIngestPercentage must be between 0 and 1');
		}

		super.put({
			logLevel: payload.logLevel,
			includeSystemInfo: payload.includeSystemInfo,
			pollInterval: payload.pollInterval,
			logIngestPercentage: payload.logIngestPercentage,
		});
	}
}
