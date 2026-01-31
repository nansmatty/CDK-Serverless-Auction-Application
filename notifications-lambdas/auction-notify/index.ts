import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { logger } from '../../auctions-lambdas/_shared/logger';

const ses = new SESClient({});

const SENDER_EMAIL = process.env.SENDER_EMAIL!;

export const handler = async (event: any, context: any) => {
	logger('INFO', `Received ${event.Records.length} SQS records`);

	for (const record of event.Records) {
		const messageId = record.messageId;
		try {
			logger('INFO', `Procesing message ${messageId}`);

			const body = JSON.parse(record.body);

			const { auctionId, finalPrice, winnerEmail, winnerName } = body;

			logger('INFO', `Auction ${auctionId}, winner ${winnerEmail}, price ${finalPrice}`);

			if (!winnerEmail) {
				logger('INFO', `Auction ${auctionId} has no winner, skipping email`);
				continue;
			}

			const command = new SendEmailCommand({
				Source: SENDER_EMAIL,
				Destination: {
					ToAddresses: [winnerEmail],
				},
				Message: {
					Subject: {
						Data: `You won auction ${auctionId}!`,
					},
					Body: {
						Text: {
							Data: `
                Dear ${winnerName},              
                Congratulations!
                You won the auction ${auctionId} with a bid of ${finalPrice}.
                Thank you for participating.`,
						},
					},
				},
			});

			logger('INFO', `Email sent for message ${messageId}`);

			await ses.send(command);
		} catch (err) {
			// throw so SQS will retry this message later
			logger('ERROR', 'Failed to process SQS record', { err });
			throw err;
		}
	}
};
