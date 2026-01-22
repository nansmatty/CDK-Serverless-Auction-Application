import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { logger } from '../_shared/logger';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const s3Client = new S3Client({});

const TABLE_NAME = process.env.AUCTIONS_TABLE!;
const BUCKET_NAME = process.env.AUDIT_BUCKET_NAME!;

interface AuctionClosedEvent {
	detail: {
		auctionId: string;
		closedAt: string;
		closeVersion?: number;
	};
}

export const handler = async (event: AuctionClosedEvent, context: any) => {
	const { auctionId, closedAt } = event.detail;

	try {
		// FETCH AUCTION
		const getAuctionResponse = await docClient.send(
			new GetCommand({
				TableName: TABLE_NAME,
				Key: {
					PK: `AUCTION#${auctionId}`,
					SK: 'AUCTION',
				},
				ConsistentRead: true,
			}),
		);

		if (!getAuctionResponse.Item) {
			logger('WARN', 'Audit auction lambda runned', {
				message: 'Auction not found, skipping audit',
				auctionId,
				requestId: context.awsRequestId,
			});

			return;
		}

		const auctionItem = getAuctionResponse.Item;

		if (auctionItem.status !== 'CLOSED') {
			logger('WARN', 'Audit auction lambda runned', {
				message: 'Auction not closed, skipping audit',
				auctionId,
				requestId: context.awsRequestId,
			});

			return;
		}

		// Fetch all the bids related to this auctionItem

		const bidsResponse = await docClient.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				KeyConditionExpression: 'PK = :pk AND begins_with(SK, :bidPrefix)',
				ExpressionAttributeValues: {
					':pk': `AUCTION#${auctionId}`,
					':bidPrefix': 'BID#',
				},
				ConsistentRead: false,
			}),
		);

		const bids = (bidsResponse.Items ?? []).map((bidItem) => ({
			bidId: bidItem.SK,
			bidderId: bidItem.bidderId,
			amount: bidItem.amount,
			placedAt: bidItem.createdAt,
		}));

		// Derive winner (pure functions)

		const sortedBids = [...bids].sort((a, b) => b.amount - a.amount);
		const winningBid = sortedBids[0] ?? null;

		// Build audit object (immutable)

		const audit = {
			auctionId,
			title: auctionItem.title,
			closedAt,
			bidCount: bids.length,
			winnerBidId: winningBid?.bidId ?? null,
			winnerBidderId: winningBid?.bidderId ?? null,
			winningAmount: winningBid?.amount ?? null,
			bids,
			generatedAt: new Date().toISOString(),
			schemaVersion: 1,
		};

		// Deterministic s3 key

		const s3Key = `audits/${audit.title}#${auctionId}/closedAt=${closedAt}.json`;

		await s3Client.send(
			new PutObjectCommand({
				Bucket: BUCKET_NAME,
				Key: s3Key,
				Body: JSON.stringify(audit, null, 2),
				ContentType: 'application/json',
			}),
		);

		logger('WARN', 'Audit auction lambda runned', {
			message: 'Audit generated successfully',
			auctionId,
			s3Key,
			requestId: context.awsRequestId,
		});
	} catch (err: any) {
		logger('ERROR', 'Failed to generate audit', {
			auctionId,
			errorName: err?.name,
			errorMessage: err?.message,
			stack: err?.stack,
		});
	}
};
