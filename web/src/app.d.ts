declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface Platform {
			env?: Record<string, unknown>;
			context?: unknown;
		}
	}
}

export {};
