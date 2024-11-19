import axios, {AxiosInstance} from 'axios';
import { server, databases, logger } from 'harperdb';
import config from "./config.json" with { type: "json" };

interface HydrolixConfig {
	url: string;
	username: string;
	password: string;
	project: string;
	table: string;
}

type HydrolixToken = string;

function hydrolixClient(baseUrl: string, token: HydrolixToken): AxiosInstance {
	return axios.create({
		baseURL: baseUrl,
		headers: {'Authorization': `Bearer ${token}`},
	});
}

async function loginToHydrolix(cfg: HydrolixConfig): Promise<HydrolixToken> {
	const res = await axios.post(`${cfg.url}/config/v1/login/`,
		{ username: cfg.username, password: cfg.password });
	if (res.status === 200) {
		return res.data.auth_token.access_token;
	} else {
		throw new Error(res.statusText);
	}
}

type HydrolixClient = AxiosInstance & { hydrolixCfg: HydrolixConfig };

async function initHydrolixSession(cfg: HydrolixConfig): Promise<HydrolixClient> {
	const token = await loginToHydrolix(cfg);
	logger.notify("Logged into Hydrolix");
	const client = hydrolixClient(cfg.url, token) as HydrolixClient;
	client.hydrolixCfg = cfg;
	return client;
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
