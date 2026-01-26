import { JwtUtils } from '../../utils/jwt-utils-functions';
import { AuthUtils } from '../../utils/auth-utils-functions';
import { logger } from '../../auctions-lambdas/_shared/logger';
import jwt from 'jsonwebtoken';

const NODE_ENV = process.env.NODE_ENV || 'dev';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

export const handler = async (event: any, context: any) => {
	logger('INFO', 'Refresh token hit');

	try {
		const cookieHeader = event.headers?.cookie || event.headers?.Cookie;

		if (!cookieHeader) {
			return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
		}

		const cookies = Object.fromEntries(
			cookieHeader.split(';').map((c: string) => {
				const [k, ...v] = c.trim().split('=');
				return [k, v.join('=')];
			}),
		);

		const refreshToken = cookies.refreshToken;

		if (!refreshToken) {
			return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
		}

		// Verify refresh token
		const payload: any = jwt.verify(refreshToken, REFRESH_SECRET);

		// Issue new access token
		const accessToken = JwtUtils.generateAccessToken({
			sub: payload.sub,
		});

		const isProd = NODE_ENV === 'production';
		const accessCookie = AuthUtils.accessCookie(isProd, accessToken);

		return {
			statusCode: 200,
			headers: {
				'Set-Cookie': accessCookie,
			},
			body: JSON.stringify({ message: 'Token refreshed' }),
		};
	} catch (err) {
		logger('ERROR', 'Refresh token failed', { error: err });
		return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
	}
};
