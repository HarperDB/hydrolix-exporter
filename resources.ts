import { server, databases, logger } from 'harperdb';
import config from "./config.json" with { type: "json" };
import { URL } from 'url';
import stream from 'node:stream';
import http from 'node:http';

interface HydrolixConfig {
	url: string;
	username: string;
	password: string;
	project: string;
	table: string;
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

	}
}


}

async function sendEvent(client: HydrolixClient, event: any) {
	const cfg = client.hydrolixCfg;
	// TODO: We may need to define a "transformer" to teach Hydrolix how to interpret our analytics data
	return client.post("/ingest/event", event,
		{ headers: { 'x-hdx-table': `${cfg.project}.${cfg.table}` }}
	);
}

async function runExporter() {
	const cfg = config.hydrolix as HydrolixConfig;
	logger.notify("Loading Hydrolix config")
	const hydrolix = await initHydrolixSession(cfg);
	const events = await databases.system.hdb_raw_analytics.subscribe({
		omitCurrent: false,
	});
	for await (const event of events) {
		// TODO: Drop this to debug or trace level once this is all working
		logger.warn("Exporting event to Hydrolix:", event);
		sendEvent(hydrolix, event).catch(e => logger.error("Error sending event to Hydrolix:", event, e));
	}
}

async function run() {
	if (server.workerIndex === 1) {
		logger.notify('Running Hydrolix exporter...');
		await runExporter();
		logger.notify('Hydrolix exporter shutting down');
	}
}

// TODO: Get rid of this once this is all working
async function generateDummyAnalytics() {
	if (server.workerIndex === 1) {
		logger.notify("WHEEEEEEE!!!!!");
		for (let i = 0; i < 1000; i++) {
			server.recordAnalytics(i, "loop-de-loop");
		}
	}
}

run();

generateDummyAnalytics();
