import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';
import { authenticate, requireAdmin } from '../../utils/auth-middleware';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;

	logger('INFO', 'Update auction data request received.', {
		requestId: context.awsRequestId,
		auctionId,
	});

	if (!auctionId) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing the auction id.' }),
		};
	}

	const user = authenticate(event);
	requireAdmin(user);

	const body = JSON.parse(event.body || '{}');
	const { title, startingPrice, durationMinutes, description } = body;

	// per-field validation (only if provided)
	if (title !== undefined && typeof title !== 'string') {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid title' }) };
	}

	if (description !== undefined && typeof description !== 'string') {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid description' }) };
	}

	if (startingPrice !== undefined && typeof startingPrice !== 'number') {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid startingPrice' }) };
	}

	if (durationMinutes !== undefined && typeof durationMinutes !== 'number') {
		return { statusCode: 400, body: JSON.stringify({ message: 'Invalid durationMinutes' }) };
	}

	if (durationMinutes !== undefined && durationMinutes > 60 * 24 * 7) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Auction duration cannot exceed 7 days' }),
		};
	}

	const now = Math.floor(Date.now() / 1000);
	const endsAt = now + durationMinutes * 60;
	const TEN_DAYS = 10 * 24 * 60 * 60;
	const timeToLive = endsAt + TEN_DAYS;

	try {
		const auctionItem = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
			}),
		);

		if (!auctionItem.Item) {
			return {
				statusCode: 404,
				body: JSON.stringify({ message: 'Auction item not found' }),
			};
		}

		const auction = auctionItem.Item;

		if (auction.status !== 'OPEN') {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Only open auctions can be updated' }),
			};
		}

		if (auction.highestBidderId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Cannot update an auction that already has bids' }),
			};
		}

		if (auction.endsAt <= now) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Auction has already ended' }),
			};
		}

		const newTitle = title ?? auction.title;
		const newDescription = description ?? auction.description;
		const newStartingPrice = startingPrice ?? auction.startingPrice;

		let newEndsAt = auction.endsAt;
		let newTtl = auction.recordExpiresAt;

		// only change time if durationMinutes is provided
		if (durationMinutes !== undefined) {
			newEndsAt = now + durationMinutes * 60;
			newTtl = newEndsAt + TEN_DAYS;
		}

		await docClient.send(
			new UpdateCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
				UpdateExpression: `SET title = :titleData, 
          description = :descData,
          startingPrice = :priceData,
          endsAt = :endsAtData,
          recordExpiresAt = :timeToLiveData,
          #updatedTime = :now
        `,
				ConditionExpression: '#status = :open AND attribute_not_exists(highestBidderId)',
				ExpressionAttributeNames: {
					'#updatedTime': 'updatedAt',
					'#status': 'status',
				},
				ExpressionAttributeValues: {
					':titleData': newTitle,
					':descData': newDescription,
					':priceData': newStartingPrice,
					':endsAtData': newEndsAt,
					':ttlData': newTtl,
					':open': 'OPEN',
					':now': now,
				},
			}),
		);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Updating the auction successful' }),
		};
	} catch (err) {
		logger('ERROR', 'Failed to update the auction', {
			auctionId,
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
