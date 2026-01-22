import { Construct } from 'constructs';

interface AuthLambdasProps {
	tableName: string;
}

export class AuthLambdas extends Construct {
	constructor(scope: Construct, id: string, props: AuthLambdasProps) {
		super(scope, id);
	}
}
