import { Stack, StackProps } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from './Statics';


export class ParameterStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);


    const dbSecret = new Secret(this, 'db-secret', {
      description: 'Secret for postgress database',
      generateSecretString: {
        excludePunctuation: true,
      },
    });

    new StringParameter(this, 'db-secret-arn', {
      stringValue: dbSecret.secretArn,
      parameterName: Statics.ssmDbSecretArn,
    });

  }
}