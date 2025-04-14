import { Log, Metrics } from "../types/harper.js";

export interface ExporterService {
	initSession(): Promise<void>;
	publishLogs(logs: Log[]): Promise<void>;
	publishMetrics(metrics: Metrics): Promise<void>;
}

export abstract class BaseExporterService {
	protected readonly config: Record<string, string>;

	constructor(config: Record<string, string>) {
		this.config = config;
	}

	abstract initSession(): Promise<void>;
	abstract publishLogs(logs: Log[]): Promise<void>;
	abstract publishMetrics(metrics: Metrics): Promise<void>;
}
