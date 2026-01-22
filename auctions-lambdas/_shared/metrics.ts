import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudWatchClient = new CloudWatchClient();

export async function putMetric(name: string, value: number = 1) {
	const command = new PutMetricDataCommand({
		Namespace: 'AuctionPlatform',
		MetricData: [
			{
				MetricName: name,
				Value: value,
				Unit: 'Count',
			},
		],
	});

	await cloudWatchClient.send(command);
}
