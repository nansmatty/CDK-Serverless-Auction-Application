import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';
import { authenticate, requireAdmin } from '../../utils/auth-middleware';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;

	logger('INFO', 'Delete auction request received.', {
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

		// example fields, adjust to your actual schema
		if (auction.status !== 'OPEN') {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Only open auctions can be deleted' }),
			};
		}

		if (auction.highestBidderId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Cannot delete an auction with bids' }),
			};
		}

		await docClient.send(
			new DeleteCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
				ConditionExpression: '#status = :open AND attribute_not_exists(highestBidderId)',
				ExpressionAttributeNames: {
					'#status': 'status',
				},
				ExpressionAttributeValues: {
					':open': 'OPEN',
				},
			}),
		);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Deleting the auction successful' }),
		};
	} catch (err) {
		logger('ERROR', 'Failed to delete the auction', {
			auctionId,
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
