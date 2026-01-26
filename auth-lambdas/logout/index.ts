import { logger } from '../../auctions-lambdas/_shared/logger';

const NODE_ENV = process.env.NODE_ENV || 'dev';

export const handler = async () => {
	const isProd = NODE_ENV === 'production';

	const clearAccessCookie = ['accessToken=', 'HttpOnly', 'Path=/', 'Max-Age=0', isProd ? 'Secure' : '', 'SameSite=Lax'].filter(Boolean).join('; ');

	const clearRefreshCookie = ['refreshToken=', 'HttpOnly', 'Path=/auth/refresh', 'Max-Age=0', isProd ? 'Secure' : '', 'SameSite=Lax']
		.filter(Boolean)
		.join('; ');

	logger('INFO', 'User logged out');

	return {
		statusCode: 200,
		headers: {
			'Set-Cookie': [clearAccessCookie, clearRefreshCookie],
		},
		body: JSON.stringify({ message: 'Logged out successfully' }),
	};
};
