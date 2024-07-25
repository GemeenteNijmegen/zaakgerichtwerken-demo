import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Aspects, CustomResource, Stack, StackProps } from 'aws-cdk-lib';
import { IVpc, SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { DatabaseConstruct } from './constructs/DatabaseConstruct';
import { VpcConstruct } from './constructs/VpcConstruct';
import { PostgresFunction } from './lambdas/postgres/postgres-function';
import { Statics } from './Statics';


export class DatabaseStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const vpc = new VpcConstruct(this, 'vpc');

    const dbCreds = this.importDatabaseSecret();
    const db = new DatabaseConstruct(this, 'db', {
      vpc: vpc.vpc,
      databaseSecret: dbCreds,
    });

    const sqlLambda = this.setupPostgresLambda(vpc.vpc);

    // Trigger the sql lambda
    const provider = new Provider(this, 'custom-resource-provider', {
      onEventHandler: sqlLambda,
    });
    const resource = new CustomResource(this, 'custom-resource', {
      serviceToken: provider.serviceToken,
    });
    resource.node.addDependency(db.postgresDatabase);


  }

  private importDatabaseSecret() {
    const arn = StringParameter.valueForStringParameter(this, Statics.ssmDbCredentialsArn);
    return Secret.fromSecretPartialArn(this, 'db-credentials', arn);
  }

  setupPostgresLambda(vpc: IVpc) {

    const dbCredsArn = StringParameter.valueForStringParameter(this, Statics.ssmDbCredentialsArn);
    const dbCreds = Secret.fromSecretCompleteArn(this, 'db-creds', dbCredsArn);

    return new PostgresFunction(this, 'create-database', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      environment: {
        DB_USERNAME: dbCreds.secretValueFromJson('username').toString(),
        DB_PASSWORD: dbCreds.secretValueFromJson('password').toString(),
        DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
        DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      },
    });

  }

}