import { databases, logger } from 'harperdb';
import { CONFIG_REFRESH_MS, DEFAULT_EXPORT_CONFIG } from './constants/index.js';
import { LogExportDestination, type LogExportConfiguration } from './types/graphql.js';
import { HarperSystemInfoService } from './services/harper.js';
import { HydrolixService } from './services/hydrolix.js';
import config from './config.json' with { type: 'json' };
import type { ExporterService } from './services/exporter.js';

const getExporterConfig = async (): Promise<LogExportConfiguration> =>
	(await databases.LogsExporter.LogExportConfiguration.get(LogExportDestination.Hydrolix)) ?? DEFAULT_EXPORT_CONFIG;

const getDataLakeService = (provider: string, config: Record<string, string>): ExporterService => {
	switch (provider) {
		case LogExportDestination.Hydrolix:
			return new HydrolixService(config);
		default:
			throw new Error(`Unsupported provider: ${provider}`);
	}
}

export const runExporter = async () => {
	let exporterConfig = await getExporterConfig();
	logger.info('Running job with config:', exporterConfig);

	const dataLakeConfig = config.hydrolix;
	const dataLakeClient = getDataLakeService(exporterConfig.destination, dataLakeConfig);
	await dataLakeClient.initSession();
	logger.info(`Logged in to ${exporterConfig.destination}`);

	const harperSystemInfo = new HarperSystemInfoService(exporterConfig.logLevel, exporterConfig.logIngestPercentage);

	let lastExecutionTime = 0;
	let pollIntervalId: NodeJS.Timeout | null = null;
	let pollInterval = exporterConfig.pollInterval;

	const poll = async () => {
		logger.info('Executing job logic...');

		const currentTime = Date.now();
		if (currentTime - lastExecutionTime >= CONFIG_REFRESH_MS) {
			logger.info(`${CONFIG_REFRESH_MS / 1000}s passed... refreshing config`);
			exporterConfig = await getExporterConfig();
			harperSystemInfo.updateSettings(exporterConfig.logLevel, exporterConfig.logIngestPercentage);
			logger.info('Refreshed config:', exporterConfig);

			// Update the polling interval if it has changed
			if (pollInterval !== exporterConfig.pollInterval && pollIntervalId) {
				pollInterval = exporterConfig.pollInterval;
				clearInterval(pollIntervalId);
				pollIntervalId = setInterval(poll, pollInterval * 1000);
			}
		}

		lastExecutionTime = currentTime;

		const logs = await harperSystemInfo.getLogs();
		await dataLakeClient.publishLogs(logs);
		logger.info(`Published ${logs.length} logs`);

		if (exporterConfig.includeSystemInfo) {
			const systemInfo = await harperSystemInfo.getSystemInfo();
			await dataLakeClient.publishMetrics(systemInfo);
			logger.info('Published system analytics');
		}
	};

	poll();

	pollIntervalId = setInterval(poll, pollInterval * 1000);
};
