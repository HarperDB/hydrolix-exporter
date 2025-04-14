export interface HydrolixConfig {
	url: string;
	username: string;
	password: string;
	project: string;
	logs_table: string;
	logs_transform: string;
	analytics_table: string;
	analytics_transform: string;
}

export type HydrolixSession = SuccessfulLoginResponse;

export interface HydrolixClientLoggedIn {
	session: HydrolixSession;
}

export interface LoginBody {
	username: string;
	password: string;
}

export interface HydrolixObject {
	uuid: string;
	name: string;
}

export type HydrolixOrg = HydrolixObject;

export interface LoginResponse {
	[propName: string]: any;
}

export interface SuccessfulLoginResponse extends LoginResponse {
	auth_token: { access_token: string };
	orgs: HydrolixOrg[];
}

export interface ErrorLoginResponse extends LoginResponse {
	detail: string;
}
