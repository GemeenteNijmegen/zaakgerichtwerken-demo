
import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Stack, StackProps, Aspects,
} from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DnsConstruct } from './constructs/DnsConstruct';
import { VpcConstruct } from './constructs/VpcConstruct';
import { ZgwCluster } from './constructs/ZgwCluster';
import { RabbitMQService } from './services/RabbitMqService';
import { ObjectsService } from './zgw/ObjectsService';
import { ObjecttypesService } from './zgw/ObjecttypesService';
import { OpenKlantService } from './zgw/OpenKlantService';
import { OpenNotificatiesService } from './zgw/OpenNotificatiesService';
import { OpenZaakService } from './zgw/OpenZaakService';


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

    // Objecten APIs
    this.addObjectsService();
    this.addObjecttypesService();
    this.addOpenZaakService();
    this.addOpenKlant();

    const notificaties = this.addOpenNotificatiesService();

    // // Setup RabbitMQ and allow services to access the service
    const rabbitmq = this.addRabbitMqService();
    rabbitmq.fargateService.connections.allowFrom(notificaties.getZgwService('open-notificaties').service.connections, Port.tcp(RabbitMQService.PORT));
    rabbitmq.fargateService.connections.allowFrom(notificaties.getZgwService('open-notificaties-celery').service.connections, Port.tcp(RabbitMQService.PORT));
    rabbitmq.fargateService.connections.allowFrom(notificaties.getZgwService('open-notificaties-celery-beat').service.connections, Port.tcp(5672));
  }


  addRabbitMqService() {
    return new RabbitMQService(this, 'rabbitmq', {
      zgwCluster: this.zgwCluster,
      desiredtaskcount: 1,
      useSpotInstances: true,
    });
  }

  addObjectsService() {
    return new ObjectsService(this, 'objects', {
      zgwCluster: this.zgwCluster,
      useSpotInstances: true,
    });
  }

  addObjecttypesService() {
    return new ObjecttypesService(this, 'objecttypes', {
      zgwCluster: this.zgwCluster,
      useSpotInstances: true,
    });
  }

  addOpenZaakService() {
    return new OpenZaakService(this, 'open-zaak', {
      zgwCluster: this.zgwCluster,
      useSpotInstances: true,
    });
  }

  addOpenNotificatiesService() {
    return new OpenNotificatiesService(this, 'open-notificaties', {
      zgwCluster: this.zgwCluster,
      useSpotInstances: true,
    });
  }

  addOpenKlant() {
    return new OpenKlantService(this, 'open-klant', {
      zgwCluster: this.zgwCluster,
      useSpotInstances: true,
    });
  }


}
