import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
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
		});

		// Api gateway config and healthcheck lambda implementation
		const api = new apiGateway.RestApi(this, 'AuctionApi', {
			restApiName: 'Auction Service',
		});

		api.root.addResource('health').addMethod('GET', new apiGateway.LambdaIntegration(healthCheckLambda));
	}
}
