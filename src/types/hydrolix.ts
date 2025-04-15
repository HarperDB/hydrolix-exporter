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
export type HydrolixProject = HydrolixObject;
export type HydrolixTable = HydrolixObject;
export type HydrolixTransform = HydrolixObject;

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
