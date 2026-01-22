import bcrypt from 'bcryptjs';

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
}
