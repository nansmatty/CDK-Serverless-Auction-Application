import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '../_shared/logger';
import { authenticate, requireAdmin } from '../../utils/auth-middleware';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUCTIONS_TABLE = process.env.AUCTIONS_TABLE!;
const AUTH_TABLE = process.env.AUTH_TABLE!;

export const handler = async (event: any, context: any) => {
	const auctionId = event.pathParameters?.auctionId;

	logger('INFO', 'Result auction data request received.', {
		requestId: context.awsRequestId,
		auctionId,
	});

	if (!auctionId) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'Missing the auction id.' }),
		};
	}

	authenticate(event);

	try {
		const auctionItem = await docClient.send(
			new GetCommand({
				TableName: AUCTIONS_TABLE,
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

		if (auction.status !== 'CLOSED') {
			return {
				statusCode: 400,
				body: JSON.stringify({ message: 'Auction is not closed yet' }),
			};
		}

		if (!auction.highestBidderId) {
			return {
				statusCode: 200,
				body: JSON.stringify({
					auctionId,
					status: auction.status,
					winner: null,
					finalPrice: null,
					message: 'No bids on this auction',
				}),
			};
		}

		const winnerUserData = await docClient.send(
			new GetCommand({
				TableName: AUTH_TABLE,
				Key: {
					PK: `USER#${auction.highestBidderId}`,
					SK: 'PROFILE',
				},
			}),
		);

		const winner = winnerUserData.Item
			? {
					name: winnerUserData.Item.name,
					userId: auction.highestBidderId,
					email: winnerUserData.Item.email,
				}
			: null;

		return {
			statusCode: 200,
			body: JSON.stringify({
				auctionId,
				title: auction.title,
				finalPrice: auction.highestBid,
				winner,
				closedAt: auction.closedAt ?? auction.endsAt,
			}),
		};
	} catch (err) {
		logger('ERROR', 'Failed to get the auction result', {
			auctionId,
			reason: err,
		});

		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'Internal server error' }),
		};
	}
};
