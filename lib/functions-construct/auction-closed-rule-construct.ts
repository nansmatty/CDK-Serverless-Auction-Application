import { Construct } from 'constructs';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { IFunction } from 'aws-cdk-lib/aws-lambda';

interface AuctionClosedRuleProps {
	targetLambda: IFunction;
}

export class AuctionClosedRule extends Construct {
	constructor(scope: Construct, id: string, props: AuctionClosedRuleProps) {
		super(scope, id);

		const rule = new Rule(this, 'AuctionClosedRule', {
			eventPattern: {
				source: ['auction.lifecycle'],
				detailType: ['AuctionClosed'],
			},
		});

		rule.addTarget(new LambdaFunction(props.targetLambda));
	}
}
