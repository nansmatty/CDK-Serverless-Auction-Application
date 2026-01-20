import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger } from '../_shared/logger';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;
	const body = JSON.parse(event.body || '{}');

	const { bidderId, amount } = body;

	if (!auctionId || !bidderId || typeof amount !== 'number') {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing required fields' }),
		};
	}

	const now = Math.floor(Date.now() / 1000);
	const TEN_DAYS = 10 * 24 * 60 * 60;
	const timeToLive = now + TEN_DAYS;

	const bidId = randomUUID();

	logger('INFO', 'Place bid attempt', {
		auctionId,
		bidderId,
		amount,
		requestId: context.awsRequestId,
	});

	try {
		await client.send(
			new UpdateCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
				UpdateExpression: `SET highestBidAmount = :amount, highestBidderId = :bidderId, updatedAt = :now`,
				ConditionExpression: `#status = :open AND highestBidAmount < :amount AND endsAt > :now`,
				ExpressionAttributeNames: { '#status': 'status' },
				ExpressionAttributeValues: {
					':amount': amount,
					':bidderId': bidderId,
					':open': 'OPEN',
					':now': now,
				},
			}),
		);

		await client.send(
			new PutCommand({
				TableName: TABLE_NAME,
				Item: {
					PK: `AUCTION#${auctionId}`,
					SK: `BID#${now}#${bidId}`,
					bidId,
					bidderId,
					amount,
					recordExpiresAt: timeToLive,
					createdAt: now,
				},
				ConditionExpression: 'attribute_not_exists(PK)',
			}),
		);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Bid placed successfully.' }),
		};
	} catch (err: any) {
		logger('WARN', 'Bid rejected', {
			auctionId,
			bidderId,
			amount,
			reason: err,
		});

		return {
			statusCode: 409,
			body: JSON.stringify({
				message: 'Bid rejected. Amount too low or auction closed.',
			}),
		};
	}
};
