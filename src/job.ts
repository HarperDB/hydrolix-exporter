import { databases, logger } from 'harperdb';
import { CONFIG_REFRESH_MS, DEFAULT_EXPORTER_CONFIG, EXPORTER_CONFIG_KEY } from './constants/index.js';
import type { HydrolixExporterConfiguration } from './types/graphql.js';
import { HarperSystemInfoService } from './services/harper.js';
import { HydrolixService } from './services/hydrolix.js';

const getExporterConfig = async (): Promise<HydrolixExporterConfiguration> =>
	(await databases.HydrolixExporter.HydrolixExporterConfiguration.get(EXPORTER_CONFIG_KEY)) ?? DEFAULT_EXPORTER_CONFIG;

export const runExporter = async () => {
	let exporterConfig = await getExporterConfig();
	logger.info('Running job with config:', exporterConfig);

	const hydrolixClient = new HydrolixService();
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
		await hydrolixClient.publishLogs(logs);
		logger.info(`Published ${logs.length} logs`);
	};

	poll();

	pollIntervalId = setInterval(poll, pollInterval * 1000);
};
