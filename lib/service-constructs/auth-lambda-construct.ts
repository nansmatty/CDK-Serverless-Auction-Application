import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

interface AuthLambdasProps {
	tableName: string;
}

export class AuthLambdas extends Construct {
	public readonly userSignUpLambda: IFunction;

	constructor(scope: Construct, id: string, props: AuthLambdasProps) {
		super(scope, id);

		this.userSignUpLambda = new NodejsFunction(this, 'SignupUser', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'signup', 'index.ts'),
			handler: 'handler',
			environment: {
				AUTH_TABLE: props.tableName,
			},
		});
	}
}
