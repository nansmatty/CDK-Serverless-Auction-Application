import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// Here all the AWS resources will be created one by one or Define your AWS resources and infrastructure here
		// 1st: Health Check Lambda
		new lambda.Function(this, 'HealthCheckLambda', {
			runtime: lambda.Runtime.NODEJS_22_X,
			handler: 'index.handler',
			code: lambda.Code.fromAsset('lambdas/health-check'),
		});
	}
}
