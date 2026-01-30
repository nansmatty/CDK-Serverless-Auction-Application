import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { DynamoTables } from '../service-constructs/dynamodb-construct';
import { AuctionLambdas } from '../service-constructs/auction-lambda-construct';
import { AuctionScheduler } from '../service-constructs/event-bridge-construct';
import { AuditS3Bucket } from '../service-constructs/s3-bucket-construct';
import { GenerateAuditFunction } from '../functions-construct/generate-audit-function-construct';
import { AuctionClosedRule } from '../functions-construct/auction-closed-rule-construct';
import { AuthLambdas } from '../service-constructs/auth-lambda-construct';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// AWS Service Defination or Construct
		const table = new DynamoTables(this, 'DynamoTables');
		const auctionsLambdas = new AuctionLambdas(this, 'AuctionLambdas', { tableName: table.auctionTable.tableName });
		const authLambdas = new AuthLambdas(this, 'AuthLambdas', { tableName: table.authTable.tableName });
		const auditBucket = new AuditS3Bucket(this, 'AuctionAuditBucket', { environment: 'dev' });

		// API Gateway
		const api = new apiGateway.RestApi(this, 'AuctionApi', { restApiName: 'Auction Service' });
		const healthResources = api.root.addResource('health');
		const auctionResources = api.root.addResource('auctions');
		const authResources = api.root.addResource('auth');

		// Auction URL Paths
		const auctionById = auctionResources.addResource('{auctionId}');
		const bidResource = auctionById.addResource('bid');
		const closeResource = auctionById.addResource('close');

		// Authentication URL Paths
		const signup = authResources.addResource('signup');
		const resendCode = authResources.addResource('resend-code');
		const verifyUser = authResources.addResource('verify-user');
		const signin = authResources.addResource('signin');
		const refresh = authResources.addResource('refresh');
		const signout = authResources.addResource('signout');

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
		auctionById.addMethod('DELETE', new apiGateway.LambdaIntegration(auctionsLambdas.deleteAuctionLambda));
		bidResource.addMethod('POST', new apiGateway.LambdaIntegration(auctionsLambdas.placeBidLambda));
		closeResource.addMethod('POST', new apiGateway.LambdaIntegration(auctionsLambdas.closeAuctionLambda));

		// Authentication lambdas integration with API Gateways creating paths
		signup.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.userSignUpLambda));
		resendCode.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.resendOTPLambda));
		verifyUser.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.verifyUserLambda));
		signin.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.signinUserLambda));
		refresh.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.refreshTokenLambda));
		signout.addMethod('POST', new apiGateway.LambdaIntegration(authLambdas.signoutUserLambda));

		// Granting permissions to dynamodb table depending on auctionsLambdas requirement
		table.auctionTable.grantWriteData(auctionsLambdas.createAuctionLambda);
		table.auctionTable.grantReadData(auctionsLambdas.getAuctionByIdLambda);
		table.auctionTable.grantReadData(auctionsLambdas.getAllAuctionsLambda);
		table.auctionTable.grantWriteData(auctionsLambdas.placeBidLambda);
		table.auctionTable.grantReadWriteData(auctionsLambdas.processAuctionsLambda);
		table.auctionTable.grantReadWriteData(auctionsLambdas.deleteAuctionLambda);
		table.auctionTable.grantReadWriteData(auctionsLambdas.closeAuctionLambda);

		table.authTable.grantReadWriteData(authLambdas.userSignUpLambda);
		table.authTable.grantReadWriteData(authLambdas.resendOTPLambda);
		table.authTable.grantReadWriteData(authLambdas.verifyUserLambda);
		table.authTable.grantReadData(authLambdas.signinUserLambda);

		// Step Function and event-bridge
		new AuctionScheduler(this, 'AuctionCloseSchedule', { processLambdaFunction: auctionsLambdas.processAuctionsLambda });
		new AuctionClosedRule(this, 'AuctionClosedRule', { targetLambda: auditLambda.generateAuditLambda });
	}
}
