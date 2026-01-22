import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { DynamoTables } from '../service-constructs/dynamodb-construct';
import { AuctionLambdas } from '../service-constructs/lambda-construct';
import { AuctionScheduler } from '../service-constructs/event-bridge-construct';
import { AuditS3Bucket } from '../service-constructs/s3-bucket-construct';
import { GenerateAuditFunction } from '../functions-construct/generate-audit-function-construct';
import { AuctionClosedRule } from '../functions-construct/auction-closed-rule-construct';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// AWS Service Defination or Construct
		const table = new DynamoTables(this, 'AuctionTable');
		const auctionsLambdas = new AuctionLambdas(this, 'AuctionLambdas', { tableName: table.auctionTable.tableName });
		const auditBucket = new AuditS3Bucket(this, 'AuctionAuditBucket', { environment: 'dev' });

		// API Gateway
		const api = new apiGateway.RestApi(this, 'AuctionApi', { restApiName: 'Auction Service' });
		const healthResources = api.root.addResource('health');
		const auctionResources = api.root.addResource('auctions');
		const auctionById = auctionResources.addResource('{auctionId}');
		const bidResource = auctionById.addResource('bid');

		// list of external function which grants or special features
		auctionsLambdas.grantOperationalPublishing();

		// Audit Lambda
		const auditLambda = new GenerateAuditFunction(this, 'GenerateAuditLambda', {
			auditBucket: auditBucket.bucket,
			auctionTable: table.auctionTable,
		});

		// Lambdas integration with API Gateways creating paths
		healthResources.addMethod('GET', new apiGateway.LambdaIntegration(auctionsLambdas.healthCheckLambda));
		auctionResources.addMethod('POST', new apiGateway.LambdaIntegration(auctionsLambdas.createAuctionLambda));
		auctionResources.addMethod('GET', new apiGateway.LambdaIntegration(auctionsLambdas.getAllAuctionsLambda));
		auctionById.addMethod('GET', new apiGateway.LambdaIntegration(auctionsLambdas.getAuctionByIdLambda));
		bidResource.addMethod('POST', new apiGateway.LambdaIntegration(auctionsLambdas.placeBidLambda));

		// Granting permissions to dynamodb table depending on auctionsLambdas requirement
		table.auctionTable.grantWriteData(auctionsLambdas.createAuctionLambda);
		table.auctionTable.grantReadData(auctionsLambdas.getAuctionByIdLambda);
		table.auctionTable.grantReadData(auctionsLambdas.getAllAuctionsLambda);
		table.auctionTable.grantWriteData(auctionsLambdas.placeBidLambda);
		table.auctionTable.grantReadWriteData(auctionsLambdas.processAuctionsLambda);

		// Step Function and event-bridge
		new AuctionScheduler(this, 'AuctionCloseSchedule', { processLambdaFunction: auctionsLambdas.processAuctionsLambda });
		new AuctionClosedRule(this, 'AuctionClosedRule', { targetLambda: auditLambda.generateAuditLambda });
	}
}
