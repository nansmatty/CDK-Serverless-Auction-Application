import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class DynamoTables extends Construct {
	public readonly auctionTable: dynamodb.Table;
	public readonly authTable: dynamodb.Table;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		// I shouldn't hard code the table name here it will create conflict if I ever do multiple stages
		// enviroment type deploy if I remove it it will generate random based on stack name
		// resource name as well as enviroment name

		this.auctionTable = new dynamodb.Table(this, 'AuctionTable', {
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
			timeToLiveAttribute: 'recordExpiresAt',
		});

		this.auctionTable.addGlobalSecondaryIndex({
			indexName: 'GSI1',
			partitionKey: {
				name: 'GSI1PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'GSI1SK',
				type: dynamodb.AttributeType.NUMBER,
			},
			projectionType: dynamodb.ProjectionType.ALL,
		});

		this.authTable = new dynamodb.Table(this, 'AuthTable', {
			tableName: 'Authentication',
			partitionKey: {
				name: 'PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'SK',
				type: dynamodb.AttributeType.STRING,
			},
			billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
			removalPolicy: RemovalPolicy.DESTROY, // This is only for the dev platform, not for prod
			timeToLiveAttribute: 'accountVerificationExpiresAt',
		});

		this.authTable.addGlobalSecondaryIndex({
			indexName: 'EmailIndex',
			partitionKey: {
				name: 'GSI1PK',
				type: dynamodb.AttributeType.STRING,
			},
			sortKey: {
				name: 'GSI1SK',
				type: dynamodb.AttributeType.NUMBER,
			},
			projectionType: dynamodb.ProjectionType.ALL,
		});
	}
}
