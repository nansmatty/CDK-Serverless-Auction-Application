import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { AuctionTable } from '../constructs/dynamodb-construct';
import { AuctionLambdas } from '../constructs/lambda-construct';
import { AuctionScheduler } from '../constructs/event-bridge-construct';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// Auction DynamoDB Table Defination or Construct
		const auctionTable = new AuctionTable(this, 'AuctionTable');
		const lambdas = new AuctionLambdas(this, 'AuctionLambdas', {
			tableName: auctionTable.table.tableName,
		});

		const api = new apiGateway.RestApi(this, 'AuctionApi', { restApiName: 'Auction Service' });
		const healthResources = api.root.addResource('health');
		const auctionResources = api.root.addResource('auctions');

		const auctionById = auctionResources.addResource('{auctionId}');
		const bidResource = auctionById.addResource('bid');

		// Api gateway config and healthcheck lambda implementation

		lambdas.grantMetricPublishing();

		healthResources.addMethod('GET', new apiGateway.LambdaIntegration(lambdas.healthCheckLambda));
		auctionResources.addMethod('POST', new apiGateway.LambdaIntegration(lambdas.createAuctionLambda));
		auctionById.addMethod('GET', new apiGateway.LambdaIntegration(lambdas.getAuctionByIdLambda));
		bidResource.addMethod('POST', new apiGateway.LambdaIntegration(lambdas.placeBidLambda));

		auctionTable.table.grantWriteData(lambdas.createAuctionLambda);
		auctionTable.table.grantWriteData(lambdas.placeBidLambda);
		auctionTable.table.grantReadWriteData(lambdas.processAuctionsLambda);

		// Step Function and event-bridge
		new AuctionScheduler(this, 'AuctionCloseSchedule', {
			processLambdaFunction: lambdas.processAuctionsLambda,
		});
	}
}
