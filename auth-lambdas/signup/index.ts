import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../../auctions-lambdas/_shared/logger';
import { randomUUID } from 'crypto';
import { AuthUtils } from '../../utils/auth-utils-functions';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUTH_TABLE = process.env.AUTH_TABLE;

export const handler = async (event: any, context: any) => {
	const body = JSON.parse(event.body || '{}');
	const { name, email, password } = body;

	if (!name || !email || !password) {
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
	const code = AuthUtils.generateOTP();

	try {
		const emailCheck = await docClient.send(
			new QueryCommand({
				TableName: AUTH_TABLE,
				IndexName: 'EmailIndex',
				KeyConditionExpression: 'GSI1PK = :email AND GSI1SK = :user',
				ExpressionAttributeValues: { ':email': `EMAIL#${email}`, ':user': 'PROFILE' },
			}),
		);

		if (emailCheck.Items && emailCheck.Items.length > 0) {
			const userExistsData = emailCheck.Items[0];

			if (userExistsData.emailVerified === true) {
				return {
					statusCode: 400,
					body: JSON.stringify({
						emailVerified: true,
						message: 'Email already in use. Please login with the same credentials',
					}),
				};
			}

			const nowTs = Date.now();
			const accountExpiryTs = new Date(userExistsData.accountVerificationExpiresAt).getTime();

			if (!userExistsData.emailVerified && accountExpiryTs > nowTs) {
				await docClient.send(
					new UpdateCommand({
						TableName: AUTH_TABLE,
						Key: {
							PK: userExistsData.PK,
							SK: userExistsData.SK,
						},
						UpdateExpression: 'SET verificationCode = :resendCode, verificationCodeExpiresAt = :expNow, updatedAt = :now',
						ExpressionAttributeValues: {
							':resendCode': code,
							':expNow': new Date(now + 10 * 60 * 1000).toISOString(),
							':now': new Date(now).toISOString(),
						},
					}),
				);

				return {
					statusCode: 200,
					body: JSON.stringify({
						emailVerified: false,
						message: 'New OTP has been sent to your registered email. Please verify the email.',
					}),
				};
			}

			if (!userExistsData.emailVerified && accountExpiryTs < nowTs) {
				const passwordHash = await AuthUtils.generatePasswordHash(password);

				await docClient.send(
					new UpdateCommand({
						TableName: AUTH_TABLE,
						Key: {
							PK: userExistsData.PK,
							SK: userExistsData.SK,
						},
						UpdateExpression: `SET password = :password,
							verificationCode = :code,
							verificationCodeExpiresAt = :exp,
							accountVerificationExpiresAt = :accExp,
							emailVerified = :false,
							updatedAt = :now`,
						ExpressionAttributeValues: {
							':password': passwordHash,
							':code': code,
							':exp': new Date(now + 10 * 60 * 1000).toISOString(),
							':accExp': new Date(now + 48 * 60 * 60 * 1000).toISOString(),
							':false': false,
							':now': new Date(now).toISOString(),
						},
					}),
				);

				return {
					statusCode: 200,
					body: JSON.stringify({
						emailVerified: false,
						message: 'User registered successfully. OTP has been sent to your registered email.',
					}),
				};
			}
		} else {
			const passwordHash = await AuthUtils.generatePasswordHash(password);

			const items = {
				PK: `USER#${userID}`,
				SK: 'PROFILE',
				GSI1PK: `EMAIL#${email}`,
				GSI1SK: `PROFILE`,
				name,
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

			await docClient.send(
				new PutCommand({
					TableName: AUTH_TABLE,
					Item: items,
					ConditionExpression: 'attribute_not_exists(PK)',
				}),
			);

			logger('INFO', 'User created', {
				userID,
				requestId: context.awsRequestId,
			});
		}

		return {
			statusCode: 201,
			body: JSON.stringify({
				userID,
				message: 'User registered successfully. OTP has been sent to your registered email.',
			}),
		};
	} catch (err: any) {
		logger('ERROR', 'Failed to create an user', {
			userID,
			errorName: err?.name,
			errorMessage: err?.message,
			errorStack: err?.stack,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Signup failed' }),
		};
	}
};
