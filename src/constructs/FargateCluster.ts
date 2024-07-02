import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { Cluster } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface FargateClusterProps {
  vpc: IVpc;
}


export class FargateCluster extends Construct {

  readonly cluster: Cluster;

  constructor(scope: Construct, id: string, props: FargateClusterProps) {
    super(scope, id);
    this.cluster = this.constructEcsCluster(props);
  }

  /**
   * Create an ECS cluster
   */
  private constructEcsCluster(props: FargateClusterProps) {
    const cluster = new Cluster(this, 'cluster', {
      vpc: props.vpc,
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });

    return cluster;
  }

}