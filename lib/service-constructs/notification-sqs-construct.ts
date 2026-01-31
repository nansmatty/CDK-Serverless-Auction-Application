import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';

interface NotificationQueueProps {
	environment: 'dev' | 'prod';
}

export class NotificationQueue extends Construct {
	public readonly auctionClosedQueue: sqs.Queue;

	constructor(scope: Construct, id: string, props: NotificationQueueProps) {
		super(scope, id);

		const isProd = props.environment === 'prod';
		const auctionClosedDLQ = new sqs.Queue(this, 'AuctionClosedDLQ');

		this.auctionClosedQueue = new sqs.Queue(this, 'AuctionClosedQueue', {
			visibilityTimeout: Duration.seconds(30),
			retentionPeriod: Duration.days(4),
			removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
			deadLetterQueue: {
				queue: auctionClosedDLQ,
				maxReceiveCount: 5,
			},
		});
	}
}
