import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Aspects, aws_ec2 as ec2,
  aws_elasticache as redis,
} from 'aws-cdk-lib';
import { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseProps {
  vpc: ec2.IVpc;
  databaseSecret: ISecret;
}

export class RedisConstruct extends Construct {

  readonly redisCluster: redis.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    // Create security group for redis
    const redisSecurityGroup = new ec2.SecurityGroup(this, 'redis-security-group', {
      vpc: props.vpc,
      allowAllOutbound: true, // TODO check if secure
    });

    // Get all private subnet ids
    const privateSubnets = props.vpc.privateSubnets.map((subnet) => subnet.subnetId);

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