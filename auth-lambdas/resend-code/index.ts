import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../auctions-lambdas/_shared/logger';
import { AuthUtils } from '../../utils/auth-utils-functions';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUTH_TABLE = process.env.AUTH_TABLE;

export const handler = async (event: any, context: any) => {
	const body = JSON.parse(event.body || '{}');
	const { email } = body;

	if (!email || !email.includes('@')) {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid email' }) };
	}

	logger('INFO', 'Resend code request received', {
		requestId: context.awsRequestId,
		email,
	});

	const now = Date.now();
	const code = AuthUtils.generateOTP();

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

		await docClient.send(
			new UpdateCommand({
				TableName: AUTH_TABLE,
				Key: {
					PK: userData.PK,
					SK: userData.SK,
				},
				UpdateExpression: 'SET verificationCode = :resendCode, verificationCodeExpiresAt = :expNow, updatedAt = :now',
				ExpressionAttributeValues: {
					':resendCode': code,
					':expNow': new Date(now + 10 * 60 * 1000).toISOString(),
					':now': new Date(now).toISOString(),
				},
			}),
		);

		logger('INFO', 'Resend code successfully', {
			email,
			requestId: context.awsRequestId,
		});

		return {
			statusCode: 201,
			body: JSON.stringify({
				email,
				message: 'New OTP has been sent to your registered email.',
			}),
		};
	} catch (err: any) {
		logger('ERROR', 'Failed to resend the code', {
			email,
			errorName: err?.name,
			errorMessage: err?.message,
			errorStack: err?.stack,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Resend code' }),
		};
	}
};
