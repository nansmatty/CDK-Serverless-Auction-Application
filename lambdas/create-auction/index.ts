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

	const body = JSON.parse(event.body || {});
	const { title, startingPrice, endsAt } = body;

	if (!title || !startingPrice || !endsAt) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing required fields' }),
		};
	}

	const auctionId = randomUUID();
	const now = Math.floor(Date.now() / 1000);

	const items = {
		PK: `AUCTION#${auctionId}`,
		SK: 'AUCTION',
		auctionId,
		title,
		startingPrice,
		status: 'OPEN',
		highestBidAmount: startingPrice,
		highestBidder: null,
		endsAt,
		createdAt: now,
		updatedAt: now,
	};

	await client.send(
		new PutCommand({
			TableName: TABLE_NAME,
			Item: items,
		})
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
