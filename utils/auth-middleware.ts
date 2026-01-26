import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET!;

export interface AuthContext {
	userId: string;
	email?: string;
	role?: string;
}

export function authenticate(event: any): AuthContext {
	const cookieHeader = event.headers?.cookie || event.headers?.Cookie;

	if (!cookieHeader) {
		throw new Error('UNAUTHORIZED');
	}

	const cookies = Object.fromEntries(
		cookieHeader.split(';').map((c: string) => {
			const [k, ...v] = c.trim().split('=');
			return [k, v.join('=')];
		}),
	);

	const token = cookies.accessToken;

	if (!token) {
		throw new Error('UNAUTHORIZED');
	}

	try {
		const payload: any = jwt.verify(token, ACCESS_SECRET);

		return {
			userId: payload.sub,
			email: payload.email,
			role: payload.role,
		};
	} catch (error) {
		throw new Error('UNAUTHORIZED');
	}
}
