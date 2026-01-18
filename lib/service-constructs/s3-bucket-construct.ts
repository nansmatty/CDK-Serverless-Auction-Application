import { RemovalPolicy } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

interface AuditS3BucketProps {
	environment: 'dev' | 'prod';
}

export class AuditS3Bucket extends Construct {
	public readonly bucket: Bucket;

	constructor(scope: Construct, id: string, props: AuditS3BucketProps) {
		super(scope, id);

		const isProd = props.environment === 'prod';

		this.bucket = new Bucket(this, 'AuctionAuditBucket', {
			encryption: BucketEncryption.S3_MANAGED,
			blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
			versioned: true,
			removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
			autoDeleteObjects: !isProd,
		});
	}
}
