import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger } from '../_shared/logger';
import { randomUUID } from 'crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	logger('INFO', 'Create auction request received.', {
		requestId: context.awsRequestId,
		body: event.body,
	});

	const body = JSON.parse(event.body || '{}');
	const { title, startingPrice, durationMinutes, description } = body;

	if (!title || !startingPrice || !description) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing required fields' }),
		};
	}

	if (!durationMinutes || durationMinutes <= 0) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Invalid duration' }),
		};
	}

	if (durationMinutes > 60 * 24 * 7) {
		throw new Error('Auction duration cannot exceed 7 days');
	}

	const auctionId = randomUUID();
	const now = Math.floor(Date.now() / 1000);
	const endsAt = now + durationMinutes * 60;
	const TEN_DAYS = 10 * 24 * 60 * 60;
	const timeToLive = endsAt + TEN_DAYS;

	const items = {
		PK: `AUCTION#${auctionId}`,
		SK: 'AUCTION',
		GSI1PK: 'STATUS#OPEN',
		GSI1SK: endsAt,
		auctionId,
		title,
		startingPrice,
		description,
		status: 'OPEN',
		highestBidAmount: startingPrice,
		highestBidderId: null,
		endsAt,
		recordExpiresAt: timeToLive,
		createdAt: now,
		updatedAt: now,
	};

	await client.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: items,
			ConditionExpression: 'attribute_not_exists(PK)',
		}),
	);

	logger('INFO', 'Auction created', {
		auctionId,
		requestId: context.awsRequestId,
	});

	return {
		statusCode: 201,
		body: JSON.stringify({
			auctionId,
			status: 'OPEN',
		}),
	};
};
