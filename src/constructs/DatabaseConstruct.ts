import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Aspects,
  aws_rds as rds, aws_ec2 as ec2, aws_kms as kms,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { Statics } from '../Statics';

export interface DatabaseProps {
  vpc: ec2.IVpc;
  databaseSecret: ISecret;
}

export class DatabaseConstruct extends Construct {

  readonly postgresDatabase: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const postgresKmsKey = new kms.Key(this, 'postgres-kms-key', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Postgress instance using the templated secret as credentials
    const postgresInstance = new rds.DatabaseInstance(this, 'postgres-instance', {
      engine: rds.DatabaseInstanceEngine.POSTGRES,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: {
        username: props.databaseSecret.secretValueFromJson('username').toString(),
        password: props.databaseSecret.secretValueFromJson('password'),
      },
      vpc: props.vpc,
      databaseName: Statics.databaseName,
      storageEncryptionKey: postgresKmsKey,
    });
    this.postgresDatabase = postgresInstance;

    new StringParameter(this, 'db-arn', {
      stringValue: postgresInstance.instanceArn,
      parameterName: Statics.ssmDbArn,
    });
    new StringParameter(this, 'db-endpoint', {
      stringValue: postgresInstance.instanceEndpoint.hostname,
      parameterName: Statics.ssmDbHostname,
    });
    new StringParameter(this, 'db-post', {
      stringValue: postgresInstance.instanceEndpoint.port.toString(),
      parameterName: Statics.ssmDbPort,
    });
    new StringParameter(this, 'db-security-group', {
      stringValue: postgresInstance.connections.securityGroups[0].securityGroupId,
      parameterName: Statics.ssmDbSecurityGroupId,
    });


  }
}