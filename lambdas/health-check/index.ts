export const handler = async () => {
	return {
		statusCode: 200,
		body: JSON.stringify({
			status: 'OK',
			service: 'auction-platform',
			timestamp: new Date().toISOString(),
		}),
	};
};
