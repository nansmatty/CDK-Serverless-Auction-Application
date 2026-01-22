import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../auctions-lambdas/_shared/logger';
import { randomUUID } from 'crypto';
import { AuthUtils } from '../../utils/auth-utils-functions';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUTH_TABLE;

export const handler = async (event: any, context: any) => {
	const body = JSON.parse(event.body || '{}');
	const { email, password } = body;

	if (!email || !password) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing required fields' }),
		};
	}

	if (!email.includes('@')) {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid email' }) };
	}

	logger('INFO', 'Signup request received', {
		requestId: context.awsRequestId,
		email,
	});

	const userID = randomUUID();
	const now = Date.now();

	const passwordHash = await AuthUtils.generatePasswordHash(password);
	const code = AuthUtils.generateOTP();

	const items = {
		PK: `USER#${userID}`,
		SK: 'PROFILE',
		GSI1PK: `EMAIL#${email}`,
		GSI1SK: `PROFILE`,
		email,
		password: passwordHash,
		role: 'USER',
		emailVerified: false,
		verificationCode: code,
		verificationCodeExpiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
		accountVerificationExpiresAt: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
		createdAt: new Date(now).toISOString(),
		updatedAt: new Date(now).toISOString(),
	};

	try {
		const emailCheck = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				IndexName: 'EmailIndex',
				KeyConditionExpression: 'GSI1PK = :email AND GSI1SK = :user',
				ExpressionAttributeValues: { ':email': `EMAIL#${email}`, ':user': 'PROFILE' },
			}),
		);

		if (emailCheck.Items && emailCheck.Items.length > 0) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Email already in use. Please login with the same credentials' }),
			};
		}

		await docClient.send(
			new PutCommand({
				TableName: TABLE_NAME,
				Item: items,
				ConditionExpression: 'attribute_not_exists(PK)',
			}),
		);

		logger('INFO', 'User created', {
			userID,
			requestId: context.awsRequestId,
		});
	} catch (err: any) {
		logger('ERROR', 'Failed to create an user', {
			userID,
			errorName: err?.name,
			errorMessage: err?.message,
			errorStack: err?.stack,
		});
	}

	return {
		statusCode: 201,
		body: JSON.stringify({
			userID,
			message: 'User registered successfully. OTP has been to your registered email.',
		}),
	};
};
