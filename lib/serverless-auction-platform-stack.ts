import { Stack, StackProps, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { join } from 'path';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// Here all the AWS resources will be created one by one or Define your AWS resources and infrastructure here
		// 1st: Health Check Lambda
		const healthCheckLambda = new NodejsFunction(this, 'HealthCheckLambda', {
			runtime: Runtime.NODEJS_22_X,
			handler: 'handler',
			entry: join(__dirname, '..', 'lambdas', 'health-check', 'index.ts'),
			bundling: {
				sourceMap: true,
				minify: true,
			},
		});

		// Adding metric permission on Lambda, So lambda can create it own metric logs
		healthCheckLambda.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['cloudwatch:PutMetricData'],
				resources: ['*'],
			})
		);

		// Api gateway config and healthcheck lambda implementation
		const api = new apiGateway.RestApi(this, 'AuctionApi', {
			restApiName: 'Auction Service',
		});

		api.root.addResource('health').addMethod('GET', new apiGateway.LambdaIntegration(healthCheckLambda));

		// Auction DynamoDB Table Defination
		const auctionTable = new dynamodb.Table(this, 'AuctionTable', {
			tableName: 'Auctions',
			partitionKey: {
				name: 'PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'SK',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		// Create Auction Lambda
		const createAuctionLambda = new NodejsFunction(this, 'CreateAuctionLambda', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', 'lambdas', 'create-auction', 'index.ts'),
			handler: 'handler',
			environment: {
				AUCTIONS_TABLE: auctionTable.tableName,
			},
		});

		auctionTable.grantWriteData(createAuctionLambda);

		api.root.addResource('auctions').addMethod('POST', new apiGateway.LambdaIntegration(createAuctionLambda));
	}
}
