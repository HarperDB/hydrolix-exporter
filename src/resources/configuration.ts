import { databases } from 'harperdb';
import type { HydrolixExporterConfiguration } from '../types/graphql.js';
import { EXPORTER_CONFIG_KEY } from '../constants/index.js';
import { BadRequestError } from '../errors/index.js';

const { HydrolixExporterConfiguration } = databases.HydrolixExporter;

export class ExportConfig extends HydrolixExporterConfiguration {
	post(payload: HydrolixExporterConfiguration) {
		if (payload.pollInterval < 1 || payload.pollInterval > 3600) {
			throw new BadRequestError('pollInterval must be between 1 and 3600 seconds');
		}

		if (payload.logIngestPercentage < 0 || payload.logIngestPercentage > 1) {
			throw new BadRequestError('logIngestPercentage must be between 0 and 1');
		}

		HydrolixExporterConfiguration.create({
			id: EXPORTER_CONFIG_KEY,
			logLevel: payload.logLevel,
			pollInterval: payload.pollInterval,
			logIngestPercentage: payload.logIngestPercentage,
		});
	}
}
