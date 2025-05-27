import { ExportConfig } from './configuration.js';
import { runExporter } from '../job.js';
// import { logger, server } from 'harperdb';

export const config = ExportConfig;

// @ts-ignore
if (server.workerIndex === 0) {
	// @ts-ignore
	logger.notify('Running logs exporter...');
	runExporter();
}
