import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;

	if (!auctionId) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing the auction id.' }),
		};
	}

	try {
		const auctionItem = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
			})
		);

		if (!auctionItem.Item) {
			return {
				statusCode: 404,
				body: JSON.stringify({ message: 'Auction item not found' }),
			};
		}

		return {
			statusCode: 200,
			body: JSON.stringify(auctionItem.Item),
		};
	} catch (err) {
		logger('ERROR', 'Failed to get auction by id', {
			auctionId,
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
