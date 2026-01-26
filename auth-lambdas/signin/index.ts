import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../auctions-lambdas/_shared/logger';
import { AuthUtils } from '../../utils/auth-utils-functions';
import { JwtUtils } from '../../utils/jwt-utils-functions';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUTH_TABLE = process.env.AUTH_TABLE;
const NODE_ENV = process.env.NODE_ENV || 'dev';

export const handler = async (event: any, context: any) => {
	const body = JSON.parse(event.body || '{}');
	const { email, password } = body;

	if (!email || !password) {
		return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) };
	}

	logger('INFO', 'Signin user request received', {
		requestId: context.awsRequestId,
		email,
	});

	try {
		const dataCheck = await docClient.send(
			new QueryCommand({
				TableName: AUTH_TABLE,
				IndexName: 'EmailIndex',
				KeyConditionExpression: 'GSI1PK = :email AND GSI1SK = :user',
				ExpressionAttributeValues: { ':email': `EMAIL#${email}`, ':user': 'PROFILE' },
			}),
		);

		if (!dataCheck.Items || dataCheck.Items.length === 0) {
			return {
				statusCode: 401,
				body: JSON.stringify({ message: 'Invalid Credentials' }),
			};
		}

		const userData = dataCheck.Items[0];

		if (!userData.emailVerified) {
			return {
				statusCode: 403,
				body: JSON.stringify({ message: 'Email is not verified. Please verify the email first.' }),
			};
		}

		// Password checking

		const passwordValid = await AuthUtils.comparePassword(password, userData.password);

		if (!passwordValid) {
			return {
				statusCode: 401,
				body: JSON.stringify({ message: 'Invalid Credentials' }),
			};
		}

		const accessToken = JwtUtils.generateAccessToken({
			sub: userData.PK,
			email: userData.email,
			role: userData.role,
		});

		const refreshToken = JwtUtils.generateRefreshToken({
			sub: userData.PK,
		});

		const isProd = NODE_ENV === 'production';

		const accessCookie = AuthUtils.accessCookie(isProd, accessToken);
		const refreshCookie = AuthUtils.refreshCookie(isProd, refreshToken);

		logger('INFO', 'Signin user successfully', {
			email,
			requestId: context.awsRequestId,
		});

		return {
			statusCode: 200,
			headers: { 'Set-Cookie': [accessCookie, refreshCookie] },
			body: JSON.stringify({ message: 'Signin successfully.' }),
		};
	} catch (err: any) {
		logger('ERROR', 'Failed to signin the user', {
			email,
			errorName: err?.name,
			errorMessage: err?.message,
			errorStack: err?.stack,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Signin user failed' }),
		};
	}
};
