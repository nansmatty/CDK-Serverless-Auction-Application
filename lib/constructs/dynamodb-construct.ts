import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';

export class AuctionTable extends Construct {
	public readonly table: dynamodb.Table;

	constructor(scope: Construct, id: string) {
		super(scope, id);

		// I shouldn't hard code the table name here it will create conflict if I ever do multiple stages
		// enviroment type deploy if I remove it it will generate random based on stack name
		// resource name as well as enviroment name

		this.table = new dynamodb.Table(this, 'AuctionTable', {
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
