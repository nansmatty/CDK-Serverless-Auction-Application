import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { logger } from '../_shared/logger';
import { putMetric } from '../_shared/metrics';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const eventBridge = new EventBridgeClient({});
const TABLE_NAME = process.env.AUCTIONS_TABLE!;

export const handler = async (event: any, context: any) => {
	const now = Math.floor(Date.now() / 1000);
	const nowIso = new Date().toISOString();

	// TODO: Replace Scan with GSI query on (status, endTime) when scale increases

	// TODO: Handle pagination using LastEvaluatedKey when auction volume grows

	try {
		const auctionsList = await client.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				IndexName: 'GSI1',
				KeyConditionExpression: 'GSI1PK = :status AND GSI1SK <= :now',
				ExpressionAttributeValues: { ':status': 'STATUS#OPEN', ':now': now },
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
			const pk = item.PK;
			const sk = item.SK;
			const auctionId = item.auctionId.S!;

			try {
				const closeAuctionCommand = new UpdateCommand({
					TableName: TABLE_NAME,
					Key: {
						PK: pk,
						SK: sk,
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
				});

				await docClient.send(closeAuctionCommand);
			} catch (err: any) {
				if (err.name === 'ConditionalCheckFailedException') {
					continue;
				}
				logger('ERROR', 'Failed to close auction', {
					pk,
					errorName: err?.name,
					errorMessage: err?.message,
					errorStack: err?.stack,
				});
				continue;
			}

			try {
				await eventBridge.send(
					new PutEventsCommand({
						Entries: [
							{
								Source: 'auction.lifecycle',
								DetailType: 'AuctionClosed',
								Detail: JSON.stringify({
									auctionId,
									closedAt: nowIso,
								}),
							},
						],
					}),
				);
			} catch (err: any) {
				logger('ERROR', 'Auction closed but failed to emit AuctionClosed event', {
					auctionId,
					reason: err,
				});
			}
		}

		await putMetric('ProcessAuctionHit');
	} catch (err: any) {
		logger('ERROR', 'Process auction failed', {
			reason: err,
		});
	}
};
