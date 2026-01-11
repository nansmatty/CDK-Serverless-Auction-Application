import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class AuctionTable extends Construct {
	public readonly auctionTable: dynamodb.Table;

	constructor(scope: Construct, id: string) {
		super(scope, id);

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
		});
	}
}
