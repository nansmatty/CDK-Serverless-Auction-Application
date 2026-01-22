import { Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { join } from 'path';

interface GenerateAuditFunctionProps {
	auditBucket: Bucket;
	auctionTable: Table;
}

export class GenerateAuditFunction extends Construct {
	public readonly generateAuditLambda: IFunction;

	constructor(scope: Construct, id: string, props: GenerateAuditFunctionProps) {
		super(scope, id);

		this.generateAuditLambda = new NodejsFunction(this, 'GenerateAuditLambda', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auctions-lambdas', 'generate-auction-audit', 'index.ts'),
			handler: 'handler',
			timeout: Duration.seconds(30),
			memorySize: 512,
			environment: {
				AUDIT_BUCKET_NAME: props.auditBucket.bucketName,
				AUCTIONS_TABLE: props.auctionTable.tableName,
			},
		});

		// Permissions
		props.auditBucket.grantWrite(this.generateAuditLambda);
		props.auctionTable.grantReadData(this.generateAuditLambda);
	}
}
