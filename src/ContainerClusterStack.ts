
import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Stack, StackProps, Aspects,
} from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DnsConstruct } from './constructs/DnsConstruct';
import { OpenNotificatiesService } from './constructs/OpenNotificatiesService';
import { OpenZaakService } from './constructs/OpenZaakService';
import { RabbitMQService } from './constructs/RabbitMqService';
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
    const notificaties = this.addOpenNotificatiesService();
    const rabbitmq = this.addRabbitMqService();
    rabbitmq.fargateService.connections.allowFrom(notificaties.fargateService.connections, Port.tcp(5672));
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
      useSpotInstances: true,
    });
  }

  addOpenNotificatiesService() {
    return new OpenNotificatiesService(this, 'open-notificaties', {
      containerImage: '',
      containerPort: 8090,
      path: 'open-notificaties',
      zgwCluster: this.zgwCluster,
      desiredtaskcount: 1,
      priority: 13,
      useSpotInstances: true,
    });
  }

  addRabbitMqService() {
    return new RabbitMQService(this, 'rabbitmq', {
      zgwCluster: this.zgwCluster,
      desiredtaskcount: 1,
      useSpotInstances: true,
    });
  }

}
