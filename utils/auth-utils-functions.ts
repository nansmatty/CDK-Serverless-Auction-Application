import bcrypt from 'bcryptjs';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './constant';

export class AuthUtils {
	static async generatePasswordHash(password: string): Promise<string> {
		const salt = await bcrypt.genSalt(10);
		return bcrypt.hash(password, salt);
	}

	static async comparePassword(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	static generateOTP() {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	static accessCookie(isProd: boolean, accessToken: string) {
		return [
			`${ACCESS_COOKIE_NAME}=${accessToken}`,
			'HttpOnly',
			'Path=/',
			`Max-Age=${15 * 60}`, // 15 minutes
			isProd ? 'Secure' : '',
			'SameSite=Lax',
		]
			.filter(Boolean)
			.join('; ');
	}

	static refreshCookie(isProd: boolean, refreshToken: string) {
		return [
			`${REFRESH_COOKIE_NAME}=${refreshToken}`,
			'HttpOnly',
			'Path=/',
			`Max-Age=${7 * 24 * 60 * 60}`, // 7 days
			isProd ? 'Secure' : '',
			'SameSite=Lax',
		]
			.filter(Boolean)
			.join('; ');
	}
}
