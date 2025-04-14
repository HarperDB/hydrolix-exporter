export interface Log {
	timestamp: string | number;
	thread: string;
	level: string;
	tags: string[];
	message: string;
}

export interface Metrics {
	memory: {
        free: number;
        used: number;
	};
	cpu: {
		current_load: {
			avgLoad: number;
            currentLoad: number;
            currentLoadUser: number;
            currentLoadSystem: number;
		};
	};
}
