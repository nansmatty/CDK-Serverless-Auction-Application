import { logger } from '../_shared/logger';

export const handler = async (event: any, context: any) => {
	logger('INFO', 'Health check called', {
		requestId: context.awsRequestId,
		path: event.path,
		method: event.httpMethod,
	});

	return {
		statusCode: 200,
		body: JSON.stringify({
			status: 'OK',
			service: 'auction-platform',
			requestId: context.awsRequestId,
			timestamp: new Date().toISOString(),
		}),
	};
};
