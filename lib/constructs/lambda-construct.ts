import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { join } from 'path';

interface AuctionLambdasProps {
	tableName: string;
}

export class AuctionLambdas extends Construct {
	public readonly healthCheckLambda: NodejsFunction;
	public readonly createAuctionLambda: NodejsFunction;
	public readonly placeBidLambda: NodejsFunction;

	constructor(scope: Construct, id: string, props: AuctionLambdasProps) {
		super(scope, id);

		this.healthCheckLambda = new NodejsFunction(this, 'HealthCheckLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: 'handler',
			entry: join(__dirname, '..', 'lambdas', 'health-check', 'index.ts'),
			bundling: {
				sourceMap: true,
				minify: true,
			},
		});

		this.createAuctionLambda = new NodejsFunction(this, 'CreateAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', 'lambdas', 'create-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.placeBidLambda = new NodejsFunction(this, 'PlaceBidLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', 'lambdas', 'place-bid', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});
	}
}
