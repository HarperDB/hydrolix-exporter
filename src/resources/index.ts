import { ExportConfig } from './configuration.js';
import { runExporter } from '../services/job.js';
import { logger, server } from 'harperdb';

export const exportConfig = ExportConfig;

if (server.workerIndex === 0) {
	logger.notify('Running logs exporter...');
	runExporter();
}
