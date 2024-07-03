
import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Stack, StackProps, Aspects,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DnsConstruct } from './constructs/DnsConstruct';
import { OpenZaakService } from './constructs/OpenZaakService';
import { VpcConstruct } from './constructs/VpcConstruct';
import { ZgwCluster } from './constructs/ZgwCluster';
import { ZgwService } from './constructs/ZgwService';


export interface ContainerClusterStackProps extends StackProps {}

export class ContainerClusterStack extends Stack {

  readonly vpc: VpcConstruct;
  readonly subdomain: DnsConstruct;
  readonly zgwCluster: ZgwCluster;

  constructor(scope: Construct, id: string, props: ContainerClusterStackProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    this.vpc = new VpcConstruct(this, 'vpc');

    this.subdomain = new DnsConstruct(this, 'subdomain', {
      subdomain: 'zgw',
    });

    /**
     * Create the loadbalancer, API gateway, ECS cluster.
     */
    this.zgwCluster = new ZgwCluster(this, 'cluster', {
      hostedzone: this.subdomain.hostedzone,
      vpc: this.vpc.vpc,
    });


    this.addHelloWorldService();

    this.addOpenZaakService();
  }


  addHelloWorldService() {
    new ZgwService(this, 'hello-world', {
      containerImage: ('nginxdemos/hello'),
      containerPort: 80,
      path: 'hello',
      desiredtaskcount: 1,
      useSpotInstances: true,
      zgwCluster: this.zgwCluster,
    });
  }


  addOpenZaakService() {
    new OpenZaakService(this, 'open-zaak', {
      containerImage: '',
      containerPort: 8080,
      path: 'open-zaak',
      zgwCluster: this.zgwCluster,
      desiredtaskcount: 1,
      priority: 12,
    });
  }

}
