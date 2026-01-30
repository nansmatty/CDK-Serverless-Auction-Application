import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { join } from 'path';

interface AuctionLambdasProps {
	tableName: string;
	authTableName: string;
}

export class AuctionLambdas extends Construct {
	public readonly healthCheckLambda: lambda.IFunction;
	public readonly createAuctionLambda: lambda.IFunction;
	public readonly getAllAuctionsLambda: lambda.IFunction;
	public readonly getAuctionByIdLambda: lambda.IFunction;
	public readonly placeBidLambda: lambda.IFunction;
	public readonly processAuctionsLambda: lambda.IFunction;
	public readonly deleteAuctionLambda: lambda.IFunction;
	public readonly closeAuctionLambda: lambda.IFunction;
	public readonly updateAuctionLambda: lambda.IFunction;
	public readonly resultAuctionLambda: lambda.IFunction;

	constructor(scope: Construct, id: string, props: AuctionLambdasProps) {
		super(scope, id);

		this.healthCheckLambda = new NodejsFunction(this, 'HealthCheckLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: 'handler',
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'health-check', 'index.ts'),
			bundling: {
				sourceMap: true,
				minify: true,
			},
		});

		this.createAuctionLambda = new NodejsFunction(this, 'CreateAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'create-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.placeBidLambda = new NodejsFunction(this, 'PlaceBidLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'place-bid', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.processAuctionsLambda = new NodejsFunction(this, 'ProcessAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'process-auctions', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
			},
		});

		this.getAuctionByIdLambda = new NodejsFunction(this, 'GetAuctionById', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'get-auction-by-id', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.getAllAuctionsLambda = new NodejsFunction(this, 'GetAllAuctions', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'get-all-auctions', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.deleteAuctionLambda = new NodejsFunction(this, 'DeleteAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'delete-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				AUTH_TABLE: props.authTableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.closeAuctionLambda = new NodejsFunction(this, 'CloseAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'auction-close', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.updateAuctionLambda = new NodejsFunction(this, 'UpdateAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'update-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});

		this.resultAuctionLambda = new NodejsFunction(this, 'ResultAuctionLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'auction-result', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: props.tableName,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
			},
		});
	}

	// Here all the AWS resources will be created one by one or Define your AWS resources and infrastructure here
	// Adding metric iam permission on Lambda, So lambda can create it own metric logs

	grantOperationalPublishing() {
		this.healthCheckLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			}),
		);

		this.processAuctionsLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData', 'events:PutEvents'],
				resources: ['*'],
			}),
		);
	}
}
