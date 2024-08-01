import { IVpc } from 'aws-cdk-lib/aws-ec2';

import { HostedZone } from 'aws-cdk-lib/aws-route53';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { FargateCluster } from './FargateCluster';
import { LoadBalancerConstruct } from './LoadbalancerConstruct';
import { RedisConstruct } from './RedisConstruct.ts';
import { Statics } from '../Statics';

interface ZgwClusterProps {
  hostedzone: HostedZone;
  vpc: IVpc;
}

export class ZgwCluster extends Construct {

  private readonly props: ZgwClusterProps;
  readonly alb: LoadBalancerConstruct;
  // readonly api: ApiConstruct;
  readonly cluster: FargateCluster;
  readonly redis: RedisConstruct;
  readonly vpc: IVpc;

  constructor(scope: Construct, id: string, props: ZgwClusterProps) {
    super(scope, id);
    this.props = props;

    const dbSecret = this.importDatabaseSecret();

    this.vpc = this.props.vpc;

    this.alb = new LoadBalancerConstruct(this, 'loadbalancer', {
      hostedzone: this.props.hostedzone,
      vpc: this.props.vpc,
    });

    // this.api = new ApiConstruct(this, 'api', {
    //   hostedzone: this.props.hostedzone,
    //   vpc: this.props.vpc,
    // });

    this.cluster = new FargateCluster(this, 'cluster', {
      vpc: this.props.vpc,
    });


    this.redis = new RedisConstruct(this, 'redis', {
      vpc: this.props.vpc,
      databaseSecret: dbSecret,
    });

  }


  private importDatabaseSecret() {
    const arn = StringParameter.valueForStringParameter(this, Statics.ssmDbSecretArn);
    return Secret.fromSecretPartialArn(this, 'db-secret', arn);
  }


}