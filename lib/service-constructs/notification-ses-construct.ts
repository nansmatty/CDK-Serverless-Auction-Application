import { Duration } from 'aws-cdk-lib';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { join } from 'path';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

interface NotificationSESProps {
	queue: sqs.Queue;
}

export class NotificationSES extends Construct {
	public readonly notificationLambda: IFunction;

	constructor(scope: Construct, id: string, props: NotificationSESProps) {
		super(scope, id);

		this.notificationLambda = new NodejsFunction(this, 'AuctionNotificationLambda', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'notifications-lambdas', 'auction-notify', 'index.ts'),
			handler: 'handler',
			timeout: Duration.seconds(30),
		});

		this.notificationLambda.addEventSource(
			new SqsEventSource(props.queue, {
				batchSize: 1,
			}),
		);

		// IAM permissions to the notification lambda
		this.notificationLambda.addToRolePolicy(
			new PolicyStatement({
				actions: ['ses:SendEmail', 'ses:SendRawEmail'],
				resources: ['*'],
			}),
		);
	}
}
