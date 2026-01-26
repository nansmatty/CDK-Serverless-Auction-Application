import jwt from 'jsonwebtoken';

export class JwtUtils {
	static generateAccessToken(payload: object) {
		return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
	}

	static generateRefreshToken(payload: object) {
		return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
	}
}
