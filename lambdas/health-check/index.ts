import { logger } from '../_shared/logger';
import { putMetric } from '../_shared/metrics';

export const handler = async (event: any, context: any) => {
	logger('INFO', 'Health check called', {
		requestId: context.awsRequestId,
		path: event.path,
		method: event.httpMethod,
	});

	try {
		await putMetric('HealthCheckHit');
	} catch (err) {
		logger('WARN', 'Metric emission failed', {
			requestId: context.awsRequestId,
			error: err,
		});
	}

	return {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			status: 'OK',
			service: 'auction-platform',
			requestId: context.awsRequestId,
			timestamp: new Date().toISOString(),
		}),
	};
};
