import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Aspects,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  aws_ec2 as ec2,
  aws_elasticache as redis,
  aws_kms as kms,
  RemovalPolicy,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DatabaseProps {
  vpc: ec2.IVpc;
  databaseSecret: secretsmanager.Secret;
}

export class Database extends Construct {

  readonly postgresDatabase: rds.DatabaseInstance;
  readonly redisCluster: redis.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    // Create security group for redis
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'redis-security-group', {
      vpc: props.vpc,
      allowAllOutbound: true, // TODO check if secure
    });


    const postgresKmsKey = new kms.Key(this, 'postgres-kms-key', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Postgress instance using the templated secret as credentials
    const postgresInstance = new rds.DatabaseInstance(this, 'postgres-instance', {
      engine: rds.DatabaseInstanceEngine.POSTGRES,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      databaseName: 'openforms',
      credentials: {
        username: props.databaseSecret.secretValueFromJson('username').toString(),
        password: props.databaseSecret.secretValueFromJson('password'),
      },
      vpc: props.vpc,
      storageEncryptionKey: postgresKmsKey,
    });
    this.postgresDatabase = postgresInstance;

    // Get all private subnet ids
    const privateSubnets = props.vpc.privateSubnets.map((subnet) => {
      return subnet.subnetId;
    });

    // Create redis subnet group from private subnet ids
    const redisSubnetGroup = new redis.CfnSubnetGroup(this, 'redis-subnet-group', {
      subnetIds: privateSubnets,
      description: 'Subnet group for redis',
    });


    // Create Redis Cluster
    const redisInstance = new redis.CfnCacheCluster(this, 'redis-cluster', {
      autoMinorVersionUpgrade: true,
      cacheNodeType: 'cache.t4g.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [redisSecurityGroup.securityGroupId],
    });

    this.redisCluster = redisInstance;
  }
}