import { logger } from 'harperdb';
import axios, { AxiosRequestConfig } from 'axios';
import type {
	ErrorLoginResponse,
	HydrolixConfig,
	HydrolixSession,
	LoginResponse,
	SuccessfulLoginResponse,
} from '../types/hydrolix.js';
import { HYDROLIX_ROUTES } from '../constants/index.js';
import type { Log, Metrics } from '../types/harper.js';
import 'dotenv/config';

export class HydrolixService {
	private readonly config: HydrolixConfig;
	private session: HydrolixSession | undefined;
	private token: string | undefined;

	constructor(cfg: HydrolixConfig) {
		this.config = cfg;
	}

	async initHydrolixSession(): Promise<void> {
		this.session = (await this.login()) as SuccessfulLoginResponse;
		this.token = this.session.auth_token.access_token;
	}

	async batchPublishLogs(logs: Log[]): Promise<void> {
		try {
			await this.ingest(logs, `${this.config.project}.${this.config.logs_table}`, `${this.config.logs_transform}`);
		} catch (error) {
			logger.error('Error sending logs to Hydrolix', error);
		}
	}

	async publishMetrics(metrics: Metrics): Promise<void> {
		try {
			await this.ingest(
				metrics,
				`${this.config.project}.${this.config.analytics_table}`,
				`${this.config.analytics_transform}`
			);
		} catch (error) {
			logger.error('Error sending metrics to Hydrolix', error);
		}
	}

	private async login(): Promise<LoginResponse> {
		try {
			const res = await this.hydrolixRequestAsync(
				HYDROLIX_ROUTES.LOGIN,
				{
					username: process.env.HYDROLIX_USERNAME,
					password: process.env.HYDROLIX_PASSWORD,
				},
				{
					headers: {
						'content-type': 'application/json; charset=UTF-8',
						'Accept': 'application/json',
					},
				}
			);

			if (res.detail && res.detail === 'Could not login') {
				return Promise.reject(new Error((res as ErrorLoginResponse).detail));
			}
			if (res.auth_token) {
				return res;
			}
			return Promise.reject(new Error((res as ErrorLoginResponse).detail));
		} catch (error) {
			return Promise.reject(error as Error);
		}
	}

	private async ingest(ingestData: Log[] | Metrics, table: string, transform: string) {
		return await this.hydrolixRequestAsync(HYDROLIX_ROUTES.INGEST, ingestData, {
			headers: {
				'x-hdx-table': table,
				'x-hdx-transform': transform,
				'content-type': 'application/json; charset=UTF-8',
				'Accept': 'application/json',
			},
		});
	}

	private async hydrolixRequestAsync(
		path: string,
		payload: any,
		options: AxiosRequestConfig = {},
		method = 'POST',
		withRetry = true
	): Promise<Record<string, any>> {
		const url = new URL(path, this.config.url).toString();

		if (path !== HYDROLIX_ROUTES.LOGIN) {
			options.headers = {
				...options.headers,
				Authorization: `Bearer ${this.token}`,
			};
		}

		logger.info('Hydrolix request:', url, options.headers);

		try {
			const response = await axios({
				url,
				method,
				data: payload,
				...options,
			});
			return response.data;
		} catch (error: any) {
			if (error.response?.status === 401 && withRetry) {
				logger.warn('Hydrolix request failed, token expired, retrying login...');
				await this.initHydrolixSession();
				return await this.hydrolixRequestAsync(path, payload, options, method, false);
			}
			throw error;
		}
	}
}
