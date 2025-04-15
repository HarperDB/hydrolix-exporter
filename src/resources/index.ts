import { ExportConfig } from './configuration.js';
import { runExporter } from '../job.js';
import { logger, server } from 'harperdb';

export const hydrolix = {
	config: ExportConfig,
};

if (server.workerIndex === 10) {
	logger.notify('Running logs exporter...');
	runExporter();
}
