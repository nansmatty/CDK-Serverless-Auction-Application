type LOG_LEVEL = 'INFO' | 'WARN' | 'ERROR';

export function logger(level: LOG_LEVEL, message: string, data: Record<string, any> = {}) {
	console.log(
		JSON.stringify({
			level,
			message,
			timestamp: new Date().toISOString(),
			...data,
		})
	);
}
