import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ServerlessAuctionPlatformStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		// Here all the AWS resources will be created one by one or Define your AWS resources and infrastructure here
	}
}
