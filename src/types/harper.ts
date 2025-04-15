export interface Log {
	timestamp: string | number;
	thread: string;
	level: string;
	tags: string[];
	message: string;
}
