import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { join } from 'path';

interface AuctionLambdasProps {
	tableName: string;
}

export class AuctionLambdas extends Construct {
	public readonly healthCheckLambda: lambda.IFunction;
	public readonly createAuctionLambda: lambda.IFunction;
	public readonly getAllAuctionsLambda: lambda.IFunction;
	public readonly getAuctionByIdLambda: lambda.IFunction;
	public readonly placeBidLambda: lambda.IFunction;
	public readonly processAuctionsLambda: lambda.IFunction;

	constructor(scope: Construct, id: string, props: AuctionLambdasProps) {
		super(scope, id);

		this.healthCheckLambda = new NodejsFunction(this, 'HealthCheckLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: 'handler',
			entry: join(__dirname, '..', '..', 'lambdas', 'health-check', 'index.ts'),
			bundling: {
				sourceMap: true,
				minify: true,
			},
		});

		this.createAuctionLambda = new NodejsFunction(this, 'CreateAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'lambdas', 'create-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.placeBidLambda = new NodejsFunction(this, 'PlaceBidLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'lambdas', 'place-bid', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.processAuctionsLambda = new NodejsFunction(this, 'ProcessAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'lambdas', 'process-auctions', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.getAuctionByIdLambda = new NodejsFunction(this, 'GetAuctionById', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'lambdas', 'get-auction-by-id', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.getAllAuctionsLambda = new NodejsFunction(this, 'GetAllAuctions', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'lambdas', 'get-all-auctions', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});
	}

	// Here all the AWS resources will be created one by one or Define your AWS resources and infrastructure here
	// Adding metric iam permission on Lambda, So lambda can create it own metric logs

	grantMetricPublishing() {
		this.healthCheckLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			})
		);

		this.processAuctionsLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			})
		);
	}
}
