import { logger } from '../_shared/logger';
import { putMetric } from '../_shared/metrics';

export const handler = async (event: any, context: any) => {
	try {
		logger('INFO', 'Health check called', {
			requestId: context.awsRequestId,
			path: event.path,
			method: event.httpMethod,
		});

		await putMetric('HealthCheckHit');

		return {
			statusCode: 200,
			body: JSON.stringify({
				status: 'OK',
				service: 'auction-platform',
				requestId: context.awsRequestId,
				timestamp: new Date().toISOString(),
			}),
		};
	} catch (err) {
		logger('WARN', 'Metric emission failed', { error: err });
	}
};
