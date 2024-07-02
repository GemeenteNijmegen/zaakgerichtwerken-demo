

import { Aws, Fn } from 'aws-cdk-lib';
import { IVpc, Vpc } from 'aws-cdk-lib/aws-ec2';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class VpcConstruct extends Construct {

  readonly vpc: IVpc;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.vpc = this.setupVpc();
  }


  private setupVpc() {
    // Import vpc config
    const publicSubnetRouteTableIds = Array(3).fill(StringParameter.valueForStringParameter(this, '/platformunited/landing-zone/vpc/route-table-public-subnets-id'));

    //VPC setup for ECS cluster
    const vpc = Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId: StringParameter.valueForStringParameter(this, '/landingzone/vpc/vpc-id'),
      availabilityZones: [0, 1, 2].map(i => Fn.select(i, Fn.getAzs(Aws.REGION))),
      privateSubnetRouteTableIds: [1, 2, 3].map(i => StringParameter.valueForStringParameter(this, `/landingzone/vpc/route-table-private-subnet-${i}-id`)),
      publicSubnetRouteTableIds:
        publicSubnetRouteTableIds,
      publicSubnetIds: [1, 2, 3].map(i => StringParameter.valueForStringParameter(this, `/landingzone/vpc/public-subnet-${i}-id`)),
      privateSubnetIds: [1, 2, 3].map(i => StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-id`)),
    });

    return vpc;
  }

}