import { DynamoDBClient, ScanCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { logger } from '../_shared/logger';
import { putMetric } from '../_shared/metrics';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const client = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});
const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const now = Math.floor(Date.now() / 1000);
	const nowIso = new Date().toISOString();

	// TODO: Replace Scan with GSI query on (status, endTime) when scale increases

	// TODO: Handle pagination using LastEvaluatedKey when auction volume grows

	try {
		const auctionsList = await client.send(
			new ScanCommand({
				TableName: TABLE_NAME,
				FilterExpression: '#status= :open AND #endTime <= :now',
				ExpressionAttributeNames: {
					'#status': 'status',
					'#endTime': 'endsAt',
				},
				ExpressionAttributeValues: {
					':open': { S: 'OPEN' },
					':now': { N: now.toString() },
				},
			}),
		);

		if (!auctionsList.Items || auctionsList.Items.length === 0) {
			logger('INFO', 'Process auction lambda runned ', {
				requestId: context.awsRequestId,
				message: 'No auction items to close',
			});
			return;
		}

		logger('INFO', 'Process auction lambda runned ', {
			message: `Found ${auctionsList.Items.length} auctions to close`,
		});

		for (const item of auctionsList.Items) {
			const pk = item.PK.S!;
			const sk = item.SK.S!;
			const auctionId = item.auctionId.S!;
			const auctionItemTitle = item.title.S!;

			try {
				const closeAuctionCommand = new UpdateItemCommand({
					TableName: TABLE_NAME,
					Key: {
						PK: { S: pk },
						SK: { S: sk },
					},
					UpdateExpression: `SET #status = :closed, #updatedTime = :now`,
					ConditionExpression: '#status = :open',
					ExpressionAttributeNames: {
						'#status': 'status',
						'#updatedTime': 'updatedAt',
					},
					ExpressionAttributeValues: {
						':closed': { S: 'CLOSED' },
						':now': { N: now.toString() },
						':open': { S: 'OPEN' },
					},
					ReturnValues: 'ALL_NEW',
				});

				await client.send(closeAuctionCommand);

				// In this part the eventbridge event will be triggered

				await eventBridge.send(
					new PutEventsCommand({
						Entries: [
							{
								Source: 'auction.lifecycle',
								DetailType: 'AuctionClosed',
								Detail: JSON.stringify({
									auctionId,
									auctionItemTitle,
									closedAt: nowIso,
								}),
							},
						],
					}),
				);
			} catch (err: any) {
				if (err.name === 'ConditionalCheckFailedException') {
					continue;
				}

				logger('ERROR', 'Failed to close auction', { pk, reason: err });
			}
		}

		await putMetric('ProcessAuctionHit');
	} catch (err: any) {
		logger('ERROR', 'Process auction failed', {
			reason: err,
		});
	}
};
