import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import { IFunction } from 'aws-cdk-lib/aws-lambda';

interface AuctionSchedulerProps {
	processLambdaFunction: IFunction;
}

export class AuctionScheduler extends Construct {
	constructor(scope: Construct, id: string, props: AuctionSchedulerProps) {
		super(scope, id);

		new events.Rule(this, 'AuctionCloseSchedule', {
			description: 'Predocially closes expired auctions',
			schedule: events.Schedule.rate(Duration.minutes(1000)),
			targets: [new targets.LambdaFunction(props.processLambdaFunction, { retryAttempts: 2 })],
		});
	}
}
