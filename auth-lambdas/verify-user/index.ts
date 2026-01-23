import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../auctions-lambdas/_shared/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUTH_TABLE = process.env.AUTH_TABLE;

export const handler = async (event: any, context: any) => {
	const body = JSON.parse(event.body || '{}');
	const { email, code } = body;

	if (!email || !code) {
		return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) };
	}

	logger('INFO', 'Verify user request received', {
		requestId: context.awsRequestId,
		email,
	});

	const now = Date.now();

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
				statusCode: 400,
				body: JSON.stringify({ message: 'Email not found. Please registered first' }),
			};
		}

		const userData = dataCheck.Items[0];

		if (userData.emailVerified === true) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Email is already verified' }),
			};
		}

		if (new Date(userData.accountVerificationExpiresAt).getTime() < now) {
			return {
				statusCode: 400,
				body: JSON.stringify({
					message: 'Verification window expired. Please sign up again.',
				}),
			};
		}

		if (new Date(userData.verificationCodeExpiresAt).getTime() < now) {
			return {
				statusCode: 400,
				body: JSON.stringify({
					message: 'Verification code expired. Please resend the code.',
				}),
			};
		}

		if (String(userData.verificationCode) !== String(code)) {
			return {
				statusCode: 400,
				body: JSON.stringify({
					message: 'Invalid verification code.',
				}),
			};
		}

		await docClient.send(
			new UpdateCommand({
				TableName: AUTH_TABLE,
				Key: {
					PK: userData.PK,
					SK: userData.SK,
				},
				UpdateExpression: `SET emailVerified = :verified, updatedAt = :now,
          REMOVE verificationCodeExpiresAt, accountVerificationExpiresAt, verificationCode`,
				ExpressionAttributeValues: {
					':verified': true,
					':now': new Date(now).toISOString(),
				},
			}),
		);

		logger('INFO', 'Verifying user successfully', {
			email,
			requestId: context.awsRequestId,
		});

		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Email verification successfully. Please login.' }),
		};
	} catch (err: any) {
		logger('ERROR', 'Failed to verify the user', {
			email,
			errorName: err?.name,
			errorMessage: err?.message,
			errorStack: err?.stack,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Verify user failed' }),
		};
	}
};
