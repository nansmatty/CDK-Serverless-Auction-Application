import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { AuctionTable } from '../service-constructs/dynamodb-construct';
import { AuctionLambdas } from '../service-constructs/lambda-construct';
import { AuctionScheduler } from '../service-constructs/event-bridge-construct';
import { AuditS3Bucket } from '../service-constructs/s3-bucket-construct';
import { GenerateAuditFunction } from '../functions-construct/generate-audit-function-construct';
import { AuctionClosedRule } from '../functions-construct/auction-closed-rule-construct';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// AWS Service Defination or Construct
		const auctionTable = new AuctionTable(this, 'AuctionTable');
		const lambdas = new AuctionLambdas(this, 'AuctionLambdas', { tableName: auctionTable.table.tableName });
		const auditBucket = new AuditS3Bucket(this, 'AuctionAuditBucket', { environment: 'dev' });

		// API Gateway
		const api = new apiGateway.RestApi(this, 'AuctionApi', { restApiName: 'Auction Service' });
		const healthResources = api.root.addResource('health');
		const auctionResources = api.root.addResource('auctions');
		const auctionById = auctionResources.addResource('{auctionId}');
		const bidResource = auctionById.addResource('bid');

		// Api gateway config and healthcheck lambda implementation
		lambdas.grantOperationalPublishing();

		// Audit Lambda
		const auditLambda = new GenerateAuditFunction(this, 'GenerateAuditLambda', {
			auditBucket: auditBucket.bucket,
			auctionTable: auctionTable.table,
		});

		// Lambdas integration with API Gateways creating paths
		healthResources.addMethod('GET', new apiGateway.LambdaIntegration(lambdas.healthCheckLambda));
		auctionResources.addMethod('POST', new apiGateway.LambdaIntegration(lambdas.createAuctionLambda));
		auctionResources.addMethod('GET', new apiGateway.LambdaIntegration(lambdas.getAllAuctionsLambda));
		auctionById.addMethod('GET', new apiGateway.LambdaIntegration(lambdas.getAuctionByIdLambda));
		bidResource.addMethod('POST', new apiGateway.LambdaIntegration(lambdas.placeBidLambda));

		// Granting permissions to dynamodb table depending on lambdas requirement
		auctionTable.table.grantWriteData(lambdas.createAuctionLambda);
		auctionTable.table.grantReadData(lambdas.getAuctionByIdLambda);
		auctionTable.table.grantReadData(lambdas.getAllAuctionsLambda);
		auctionTable.table.grantWriteData(lambdas.placeBidLambda);
		auctionTable.table.grantReadWriteData(lambdas.processAuctionsLambda);

		// Step Function and event-bridge
		new AuctionScheduler(this, 'AuctionCloseSchedule', { processLambdaFunction: lambdas.processAuctionsLambda });
		new AuctionClosedRule(this, 'AuctionClosedRule', { targetLambda: auditLambda.generateAuditLambda });
	}
}
