import { logger } from 'harperdb';
import axios, { AxiosRequestConfig } from 'axios';
import type {
	ErrorLoginResponse,
	HydrolixProject,
	HydrolixSession,
	HydrolixTable,
	HydrolixTransform,
	LoginResponse,
	SuccessfulLoginResponse,
} from '../types/hydrolix.js';
import { HYDROLIX_ROUTES } from '../constants/index.js';
import type { Log } from '../types/harper.js';
import 'dotenv/config';
import transformConfig from '../../transformTemplates/hdb_logs_transform.json' with { type: 'json' };
import { HydrolixAuthenticationError, HydrolixResourceNotFoundError } from '../errors/index.js';

export class HydrolixService {
	private readonly projectName: string = process.env.HYDROLIX_PROJECT_NAME!;
	private readonly tableName: string = process.env.HYDROLIX_TABLE_NAME!;
	private readonly transformName = 'hdb_logs_transform';
	private session: HydrolixSession | undefined;
	private token: string | undefined;

	async initHydrolixSession(): Promise<void> {
		await this.login();

		const project = await this.getProject(this.projectName);
		if (project) {
			logger.info('Hydrolix project:', project);
		} else {
			throw new HydrolixResourceNotFoundError(`Hydrolix project ${this.projectName} not found`);
		}

		const table = await this.getTable(project.uuid, this.tableName);
		if (table) {
			logger.info('Hydrolix table:', table);
		} else {
			throw new HydrolixResourceNotFoundError(`Hydrolix table ${this.tableName} not found`);
		}

		await this.ensureTransform(project.uuid, table.uuid);
	}

	async publishLogs(logs: Log[]): Promise<void> {
		try {
			await this.requestAsync(HYDROLIX_ROUTES.INGEST, 'POST', logs, {
				headers: {
					'x-hdx-table': `${this.projectName}.${this.tableName}`,
					'x-hdx-transform': this.transformName,
					'content-type': 'application/json; charset=UTF-8',
					'Accept': 'application/json',
				},
			});
		} catch (error) {
			logger.error('Error sending logs to Hydrolix', error);
		}
	}

	private async login(): Promise<void> {
		const res = await this.requestAsync(
			HYDROLIX_ROUTES.LOGIN,
			'POST',
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

		if (res.auth_token) {
			this.session = res as SuccessfulLoginResponse;
			this.token = this.session.auth_token.access_token;
			return;
		}

		throw new HydrolixAuthenticationError((res as ErrorLoginResponse).detail);
	}

	private get organizationId(): string {
		return this.session!.orgs[0].uuid;
	}

	private async getProject(projName: string): Promise<HydrolixProject | undefined> {
		const res = await this.requestAsync(HYDROLIX_ROUTES.PROJECTS(this.organizationId), 'GET');
		return res.find((p: HydrolixProject) => p.name === projName);
	}

	private async getTable(projId: string, tableName: string): Promise<HydrolixTable | undefined> {
		const res = await this.requestAsync(HYDROLIX_ROUTES.TABLES(this.organizationId, projId), 'GET');
		return res.find((t: HydrolixTable) => t.name === tableName);
	}

	private async ensureTransform(projId: string, tableId: string) {
		const exists = await this.transformExists(projId, tableId);
		if (exists) {
			logger.info(`Hydrolix transform ${this.transformName} exists`);
			return;
		}
		await this.createTransform(projId, tableId);
	}

	private async transformExists(projId: string, tableId: string): Promise<boolean> {
		const res = await this.requestAsync(HYDROLIX_ROUTES.TRANSFORMS(this.organizationId, projId, tableId), 'GET');
		return res.some((t: HydrolixTransform) => t.name === this.transformName);
	}

	private async createTransform(projId: string, tableId: string): Promise<void> {
		const res = await this.requestAsync(
			HYDROLIX_ROUTES.TRANSFORMS(this.organizationId, projId, tableId),
			'POST',
			transformConfig
		);
		logger.info('Created Hydrolix transform:', res);
	}

	private async requestAsync(
		path: string,
		method: 'POST' | 'GET',
		payload?: Record<string, any>,
		options: AxiosRequestConfig = {},
		withRetry = true
	): Promise<Record<string, any>> {
		const url = new URL(path, process.env.HYDROLIX_INSTANCE_URL).toString();

		if (path !== HYDROLIX_ROUTES.LOGIN) {
			options.headers = {
				...options.headers,
				Authorization: `Bearer ${this.token}`,
			};
		}

		logger.info('Hydrolix request:', method, url);

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
				await this.login();
				return await this.requestAsync(path, method, payload, options, false);
			}
			throw error;
		}
	}
}
