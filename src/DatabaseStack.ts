import { Stack, StackProps } from 'aws-cdk-lib';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/DatabaseConstruct';
import { VpcConstruct } from './constructs/VpcConstruct';
import { Statics } from './Statics';


export class DatabaseStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new VpcConstruct(this, 'vpc');

    new DatabaseConstruct(this, 'db', {
      vpc: vpc.vpc,
      databaseSecret: this.importDatabaseSecret(),
    });

  }

  private importDatabaseSecret() {
    const arn = StringParameter.valueForStringParameter(this, Statics.ssmDbCredentialsArn);
    return Secret.fromSecretPartialArn(this, 'db-credentials', arn);
  }

}