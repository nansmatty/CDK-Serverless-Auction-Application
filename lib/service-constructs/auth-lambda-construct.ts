import { Duration } from 'aws-cdk-lib';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { join } from 'path';

interface AuthLambdasProps {
	tableName: string;
}

export class AuthLambdas extends Construct {
	public readonly userSignUpLambda: IFunction;
	public readonly resendOTPLambda: IFunction;
	public readonly verifyUserLambda: IFunction;
	public readonly signinUserLambda: IFunction;
	public readonly refreshTokenLambda: IFunction;
	public readonly signoutUserLambda: IFunction;

	constructor(scope: Construct, id: string, props: AuthLambdasProps) {
		super(scope, id);

		this.userSignUpLambda = new NodejsFunction(this, 'SignupUser', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'signup', 'index.ts'),
			handler: 'handler',
			timeout: Duration.seconds(10),
			memorySize: 256,
			environment: {
				AUTH_TABLE: props.tableName,
			},
		});

		this.resendOTPLambda = new NodejsFunction(this, 'ResendOTP', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'resend-code', 'index.ts'),
			handler: 'handler',
			timeout: Duration.seconds(10),
			environment: {
				AUTH_TABLE: props.tableName,
			},
		});

		this.verifyUserLambda = new NodejsFunction(this, 'VerifyUser', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'verify-user', 'index.ts'),
			handler: 'handler',
			timeout: Duration.seconds(10),
			environment: {
				AUTH_TABLE: props.tableName,
			},
		});

		this.signinUserLambda = new NodejsFunction(this, 'SigninUser', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'signin', 'index.ts'),
			handler: 'handler',
			environment: {
				AUTH_TABLE: props.tableName,
				NODE_ENV: process.env.NODE_ENV!,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
				JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
			},
		});

		this.refreshTokenLambda = new NodejsFunction(this, 'RefreshToken', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'refresh', 'index.ts'),
			handler: 'handler',
			environment: {
				NODE_ENV: process.env.NODE_ENV!,
				JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET!,
				JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
			},
		});

		this.signoutUserLambda = new NodejsFunction(this, 'SignoutUser', {
			runtime: Runtime.NODEJS_22_X,
			entry: join(__dirname, '..', '..', 'auth-lambdas', 'logout', 'index.ts'),
			handler: 'handler',
			environment: {
				NODE_ENV: process.env.NODE_ENV!,
			},
		});
	}
}
