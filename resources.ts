import { server, databases, logger } from 'harperdb';
import config from "./config.json" with { type: "json" };
import { URL } from 'url';
import stream from 'node:stream';

type Transform = {
	[key: string]: any;
}

interface HydrolixConfig {
	url: string;
	username: string;
	password: string;
	project: string;
	table: string;
	sys_info_interval: number;
	transform: Transform;
}

type HydrolixToken = string;

async function hydrolixRequestAsync(cfg: HydrolixConfig, path: string, options: RequestInit, token?: HydrolixToken): Promise<Response> {
	const url = new URL(path, cfg.url);
	const headers: HeadersInit = new Headers();
	if (token) {
		headers.append('Authorization', `Bearer ${token}`);
	}
	headers.append('Accept', 'application/json');
	if (options.method === 'POST') {
		headers.append('Content-Type', 'application/json');
	}
	options.headers = headers;
	logger.debug("Hydrolix request:", url, options);
	return fetch(url, options);
}

async function hydrolixRequest<TResponse>(cfg: HydrolixConfig, path: string, options: RequestInit, token?: HydrolixToken): Promise<TResponse> {
	const response = await hydrolixRequestAsync(cfg, path, options, token);
	return await response.json() as TResponse;
}

interface HydrolixClientBase {
	config: HydrolixConfig;
	post: <TBody, TResponse>(path: string, body: TBody, options?: RequestInit) => Promise<TResponse>;
	stream: (path: string, stream: stream.Readable, options?: RequestInit) => Promise<Response>;
	get: <TResponse>(path: string, options?: RequestInit) => Promise<TResponse>;
}

type HydrolixClientLoggedOut = HydrolixClientBase;

type HydrolixSession = SuccessfulLoginResponse;

interface HydrolixClientLoggedIn extends HydrolixClientBase {
	session: HydrolixSession;
}

type HydrolixClient = HydrolixClientLoggedOut | HydrolixClientLoggedIn;

function hydrolixClient(cfg: HydrolixConfig, session?: HydrolixSession): HydrolixClient {
	// TODO: Handle token expiry
	let token: HydrolixToken;
	if (typeof session !== 'undefined') {
		token = session.auth_token.access_token;
	}
	const client = {
		config: cfg,
		post: <TBody, TResponse>(path: string, payload: TBody, options?: RequestInit) => {
			const body = JSON.stringify(payload);
			const opts = { ...options, method: 'POST', body };
			logger.debug("Hydrolix POST request opts:", opts);
			return hydrolixRequest<TResponse>(cfg, path, opts, token);
		},
		stream: (path: string, body: stream.Readable, options?: RequestInit) => {
			logger.debug("Hydrolix stream request:", path);
			const bodyStream = stream.Readable.toWeb(body) as ReadableStream<Uint8Array>;
			const opts = { ...options, method: 'POST', body: bodyStream, duplex: 'half' };
			logger.debug("Hydrolix stream request opts:", opts);
			return hydrolixRequestAsync(cfg, path, opts, token);
		},
		get: <TResponse>(path: string, queryParams?: Record<string, string>, options?: RequestInit) => {
			let searchParams;
			if (typeof queryParams !== 'undefined') {
				searchParams = new URLSearchParams(queryParams);
			}
			let pathWithQueryParams = path;
			if (typeof searchParams !== 'undefined') {
				pathWithQueryParams = `${path}?${searchParams}`;
			}
			let opts = options;
			if (typeof opts === 'undefined') {
				opts = {} as RequestInit;
			}
			return hydrolixRequest<TResponse>(cfg, pathWithQueryParams, opts, token);
		}
	};
	if (session) {
		return { ...client, session } as HydrolixClientLoggedIn;
	}
	return client as HydrolixClientLoggedOut;
}

interface LoginBody {
	username: string;
	password: string;
}

interface HydrolixObject {
	uuid: string;
	name: string;
}

type HydrolixOrg = HydrolixObject;

interface LoginResponse {
	[propName: string]: any;
}

interface SuccessfulLoginResponse extends LoginResponse {
	auth_token: { access_token: string };
	orgs: HydrolixOrg[];
}

interface ErrorLoginResponse extends LoginResponse {
	detail: string;
}

async function loginToHydrolix(client: HydrolixClient): Promise<LoginResponse> {
	try {
		const res = await client.post<LoginBody, LoginResponse>("/config/v1/login/",
			{username: client.config.username, password: client.config.password});
		logger.debug("Hydrolix login response", res);
		if (res.detail && res.detail === "Could not login") {
			return Promise.reject(res.detail);
		}
		if (res.auth_token) {
			return res as SuccessfulLoginResponse;
		}
		return Promise.reject(res as ErrorLoginResponse);
	} catch (error) {
		return Promise.reject(error);
	}
}

async function initHydrolixSession(cfg: HydrolixConfig): Promise<HydrolixClientLoggedIn> {
	const hydrolix = hydrolixClient(cfg);
	let session;
	try {
		session = await loginToHydrolix(hydrolix);
	} catch (error) {
		logger.error("Hydrolix login failed:", error);
		return Promise.reject(error);
	}
	if (session && "auth_token" in session) {
		logger.notify("Logged into Hydrolix");
		return hydrolixClient(cfg, session as SuccessfulLoginResponse) as HydrolixClientLoggedIn;
	} else {
		logger.error("Hydrolix login failed:", session);
		return Promise.reject(session);
	}
}

function hydrolixOrg(client: HydrolixClientLoggedIn): HydrolixOrg {
	return client.session.orgs[0];
}

type HydrolixProject = HydrolixObject;
type ProjectsResponse = HydrolixProject[];

async function hydrolixProject(client: HydrolixClientLoggedIn, orgId: string, projName: string): Promise<HydrolixProject | undefined> {
	const res = await client.get<ProjectsResponse>(`/config/v1/orgs/${orgId}/projects/`);
	return res.find(p => p.name === projName);
}

type HydrolixTable = HydrolixObject;
type TablesResponse = HydrolixTable[];

async function hydrolixTable(client: HydrolixClientLoggedIn, orgId: string, projId: string, tableName: string): Promise<HydrolixTable | undefined> {
	const res = await client.get<TablesResponse>(
		`/config/v1/orgs/${orgId}/projects/${projId}/tables/`
	);
	return res.find(t => t.name === tableName);
}

type TransformsResponse = Transform[];

async function transformExists(client: HydrolixClientLoggedIn, orgId: string, projId: string, tableId: string, transformName: string): Promise<boolean> {
	const res = await client.get<TransformsResponse>(
		`/config/v1/orgs/${orgId}/projects/${projId}/tables/${tableId}/transforms/`
	);
	return res.some(t => t.name === transformName);
}

type TransformCreateResponse = Transform;

async function createTransform(client: HydrolixClientLoggedIn, orgId: string, projId: string, tableId: string, transform: Transform) {
	const res = await client.post<Transform, TransformCreateResponse>(
		`/config/v1/orgs/${orgId}/projects/${projId}/tables/${tableId}/transforms/`,
		transform);
	logger.notify("Created Hydrolix transform:", res);
}

async function ensureTransform(client: HydrolixClientLoggedIn, orgId: string, projId: string, tableId: string) {
	const transform = client.config.transform;
	const transformName = transform.name;
	const exists = await transformExists(client, orgId, projId, tableId, transformName);
	if (exists) {
		logger.notify(`Hydrolix transform ${transformName} exists`);
		return;
	}
	await createTransform(client, orgId, projId, tableId, transform);
}

// TODO: Not sure how fine-grained we can / want to get with these two types
interface Event {
	[key: string]: any;
}

interface IngestResponse {
	[key: string]: any;
}

async function sendEvent(client: HydrolixClientLoggedIn, event: Event) {
	const cfg = client.config;
	try {
		return client.post<Event, IngestResponse>("/ingest/event", event,
			{
				headers: {
					'x-hdx-table': `${cfg.project}.${cfg.table}`,
					'x-hdx-transform': `${cfg.transform.name}`,
					'content-type': 'application/json; charset=UTF-8',
				}
			}
		);
	} catch (error) {
		logger.error("Error sending event to Hydrolix", client.config, event, error);
		return Promise.reject(error);
	}
}

async function streamEvents(client: HydrolixClientLoggedIn, events: stream.Readable): Promise<Response> {
	const cfg = client.config;
	return client.stream("/ingest/event", events,
		{
			headers: {
				'x-hdx-table': `${cfg.project}.${cfg.table}`,
				'x-hdx-transform': `${cfg.transform.name}`,
				'content-type': 'application/json; charset=UTF-8',
			}
		}
	);
}

const createJsonTransformer = (): stream.Transform => {
	return new stream.Transform({
		writableObjectMode: true,
		transform(chunk, _encoding, callback) {
			this.push(JSON.stringify(chunk));
			callback();
		},
	});
};

const createStreamMonitor = (): stream.PassThrough => {
	const streamMonitor = new stream.PassThrough();
	streamMonitor.on('data', (chunk: Buffer) => {
		logger.notify("streaming event: " + chunk.toString());
	});
	return streamMonitor;
};

async function systemInfo() {
	const op = {
		operation: 'system_information',
		attributes: [ 'database_metrics', 'harperdb_processes', 'replication', 'threads', 'memory' ]
	};
	const sysInfo = await databases.system.hdb_analytics.operation(op);
	return { ...sysInfo, time: Date.now() };
}

async function sendSysInfoEvents(client: HydrolixClientLoggedIn, cfg: HydrolixConfig) {
	for (;;) {
		const sysInfo = await systemInfo();
		logger.notify("sending system information to Hydrolix", sysInfo);
		const resp = await client.post<Event, IngestResponse>("/ingest/event", sysInfo,
			{
				headers: {
					'x-hdx-table': `${cfg.project}.${cfg.table}`,
					'x-hdx-transform': `${cfg.transform.name}`,
					'content-type': 'application/json; charset=UTF-8'
				}
			}
		);
		logger.notify("sys info event resp", resp);
		await new Promise(resolve => setTimeout(resolve, cfg.sys_info_interval));
	}
}

async function runExporter() {
	const cfg = config.hydrolix as HydrolixConfig;
	logger.notify("Loading Hydrolix config")
	const hydrolix = await initHydrolixSession(cfg);

	const org = hydrolixOrg(hydrolix);
	logger.notify("Hydrolix org:", org);
	const project = await hydrolixProject(hydrolix, org.uuid, cfg.project);
	if (project) {
		logger.notify("Hydrolix project:", project);
	} else {
		throw new Error(`Hydrolix project ${cfg.project} not found`);
	}
	const table = await hydrolixTable(hydrolix, org.uuid, project.uuid, cfg.table);
	if (table) {
		logger.notify("Hydrolix table:", table);
	} else {
		throw new Error(`Hydrolix table ${cfg.table} not found`);
	}

	await ensureTransform(hydrolix, org.uuid, project.uuid, table.uuid);

	sendSysInfoEvents(hydrolix, cfg);

	// const events: AsyncIterable<Event> = await databases.system.hdb_analytics.subscribe({
	// 	omitCurrent: false,
	// });
	// const eventStream = stream.Readable.from(events);

	// TODO: Extract .value from events and make that the top level object

	// const jsonTransform = createJsonTransformer();
	// const streamMonitor = createStreamMonitor();
	// const reqBody = new stream.PassThrough;
	// const eventPipeline = stream.pipeline(
	// 	events, jsonTransform, streamMonitor, reqBody,
	// 	(err) => {
	// 		if (err) {
	// 			logger.error("Event stream error", err);
	// 		} else {
	// 			logger.notify("Event stream ended");
	// 		}
	// 	}
	// );
	// eventStream.on('end', () => logger.notify("Event stream ended"));
	// eventStream.on('close', () => logger.notify("Event stream closed"));
	// eventStream.on('pause', () => logger.notify("Event stream paused"));
	// eventPipeline.on('end', () => logger.notify("Stream ended"));
	// eventPipeline.on('close', () => logger.notify("Stream closed"));
	// eventPipeline.on('pause', () => logger.notify("Stream paused"));
	// logger.notify("Stream flowing mode?", eventPipeline.readableFlowing)

	// // TODO: Decide when / how to tear this down
	// const result = await streamEvents(hydrolix, reqBody);
	// logger.notify("Event stream result:", result);

	// for await (const event of events) {
	// 	// TODO: Drop this to debug or trace level once this is all working
	// 	logger.notify("Exporting event to Hydrolix:", event);
	// 	// sendEvent(hydrolix, event).catch(e => logger.error("Error sending event to Hydrolix:", event, e));
	// }
}

async function run() {
	if (server.workerIndex === 1) {
		logger.notify('Running Hydrolix exporter...');
		await runExporter();
		logger.notify('Hydrolix exporter shutting down');
	}
}

// TODO: Get rid of this once this is all working
async function generateDummyAnalytics(metric: string) {
	if (server.workerIndex === 1) {
		logger.notify("Generating dummy analytics for metric:", metric);
		for (let i = 0; i < 1000; i++) {
			await new Promise(resolve => setTimeout(resolve, 100));
			server.recordAnalytics(i, metric);
		}
	}
}

run();

generateDummyAnalytics('loop-de-loop');

// generate some more analytics after a delay to make sure streaming still works
setTimeout(() => generateDummyAnalytics('thingy'), 10000);
