import { databases, logger } from 'harperdb';
import { CONFIG_REFRESH_MS, DEFAULT_EXPORT_CONFIG } from '../constants/index.js';
import { LogExportDestination, type LogExportConfiguration } from '../types/graphql.js';
import { HarperSystemInfoService } from './harper.js';
import { HydrolixService } from './hydrolix.js';
import type { HydrolixConfig } from '../types/hydrolix.js';
import config from '../config.json' with { type: 'json' };

const hydrolixConfig = config.hydrolix as HydrolixConfig;

const getExporterConfig = async (): Promise<LogExportConfiguration> =>
	(await databases.LogsExporter.LogExportConfiguration.get(LogExportDestination.Hydrolix)) ?? DEFAULT_EXPORT_CONFIG;

export const runExporter = async () => {
	let exporterConfig = await getExporterConfig();
	logger.info('Running job with config:', exporterConfig);

	const hydrolixClient = new HydrolixService(hydrolixConfig);
	await hydrolixClient.initHydrolixSession();
	logger.info('Logged in to Hydrolix');

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
		await hydrolixClient.batchPublishLogs(logs);
		logger.info(`Published ${logs.length} logs`);

		if (exporterConfig.includeSystemInfo) {
			const systemInfo = await harperSystemInfo.getSystemInfo();
			await hydrolixClient.publishMetrics(systemInfo);
			logger.info('Published system analytics');
		}
	};

	poll();

	pollIntervalId = setInterval(poll, pollInterval * 1000);
};
