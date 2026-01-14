import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	logger('INFO', 'Get all auction lambda function runned', {
		requestId: context.awsRequestId,
	});

	const now = Math.floor(Date.now() / 1000);

	try {
		const auctionItems = await docClient.send(
			new ScanCommand({
				TableName: TABLE_NAME,
				FilterExpression: '#status= :open AND #endTime > :now AND SK = :metadata',
				ExpressionAttributeNames: {
					'#status': 'status',
					'#endTime': 'endsAt',
				},
				ExpressionAttributeValues: {
					':open': 'OPEN',
					':now': now,
					':metadata': 'AUCTION',
				},
			})
		);

		return {
			statusCode: 200,
			body: JSON.stringify(auctionItems.Items ?? []),
		};
	} catch (err) {
		logger('ERROR', 'Failed to get auction items', {
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
