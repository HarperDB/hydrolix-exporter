import { databases, logger } from 'harperdb';
import { LogLevel } from '../types/graphql.js';
import type { Log } from '../types/index.js';

export class HarperSystemInfoService {
	private static readonly READ_LOGS_OPERATION = 'read_log';
	private static readonly READ_LOGS_LIMIT = 1000; // TODO: determine what this should be

	private lastLogPoll = new Date(Date.now() - 60000); // FIXME: set to now after testing??
	private logLevel: LogLevel;
	private logIngestPercentage: number;

	constructor(logLevel: LogLevel, logIngestPercentage: number) {
		this.logLevel = logLevel;
		this.logIngestPercentage = logIngestPercentage;
	}

	get logStartFromDateTime() {
		return this.lastLogPoll.toISOString();
	}

	updateSettings(logLevel: LogLevel, logIngestPercentage: number) {
		this.logLevel = logLevel;
		this.logIngestPercentage = logIngestPercentage;
	}

	async getLogs(): Promise<Log[]> {
		logger.info('Fetching logs with settings:', {
			logLevel: this.logLevel,
			logIngestPercentage: this.logIngestPercentage,
		});

		if (this.logIngestPercentage === 0) {
			return [];
		}

		const readLogsOperation = {
			operation: HarperSystemInfoService.READ_LOGS_OPERATION,
			start: 0,
			limit: HarperSystemInfoService.READ_LOGS_LIMIT,
			level: this.logLevel === LogLevel.All ? undefined : this.logLevel,
			from: this.logStartFromDateTime,
		};

		this.lastLogPoll = new Date();

		const result = [];
		let newLogs = [];

		do {
			newLogs = await databases.system.hdb_analytics.operation(readLogsOperation);
			result.push(...newLogs);
			readLogsOperation.start += HarperSystemInfoService.READ_LOGS_LIMIT;
		} while (newLogs.length > 0);

		const sampled = this.getLogsSample(result);
		return sampled.map((log) => ({ ...log, timestamp: new Date(log.timestamp).getTime() }));
	}

	async getSystemInfo() {
		const systemInfoOperation = {
			operation: 'system_information',
			attributes: ['memory'],
			// attributes: ['database_metrics', 'harperdb_processes', 'replication', 'threads', 'memory'],
		};
		return await databases.system.hdb_analytics.operation(systemInfoOperation);
	}

	private getLogsSample(logs: Log[]): Log[] {
		if (this.logIngestPercentage === 1) {
			return logs;
		}

		const sampleSize = Math.ceil(logs.length * this.logIngestPercentage);
		const step = logs.length / sampleSize;
		const result = [];

		for (let i = 0; i < sampleSize; i++) {
			const index = Math.floor(i * step);
			if (index < logs.length) {
				result.push(logs[index]);
			}
		}

		return result;
	}
}
