import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';
import { authenticate, requireAdmin } from '../../utils/auth-middleware';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;

	logger('INFO', 'Manually close auction request received.', {
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

	const now = Math.floor(Date.now() / 1000);

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
				body: JSON.stringify({ message: 'Only open auctions can be closed' }),
			};
		}

		if (auction.endsAt <= now) {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Only auctions that yet to be end can be closed' }),
			};
		}

		await docClient.send(
			new UpdateCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
				UpdateExpression: 'SET #status = :closed, #updatedTime = :now, GSI1PK = :closedStatus',
				ConditionExpression: '#status = :open',
				ExpressionAttributeNames: {
					'#status': 'status',
					'#updatedTime': 'updatedAt',
				},
				ExpressionAttributeValues: {
					':closed': 'CLOSED',
					':now': now,
					':closedStatus': 'STATUS#CLOSED',
					':open': 'OPEN',
				},
			}),
		);

		return {
			statusCode: 200,
			body: JSON.stringify({ message: 'Closing the auction successful' }),
		};
	} catch (err) {
		logger('ERROR', 'Failed to close the auction', {
			auctionId,
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
