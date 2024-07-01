
import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import {
  Aws, Fn, Stack, StackProps,
  aws_ecs as ecs,
  aws_ssm as ssm,
  aws_ec2 as ec2,
  aws_secretsmanager as secrets,
  aws_route53 as route53,
  aws_route53_targets as route53Targets,
  aws_certificatemanager as acm,
  aws_elasticloadbalancingv2 as loadbalancing,
  Aspects,
} from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { Database } from './constructs/DatabaseConstruct';
import { EcsFargateService } from './constructs/EcsFargateService';
import { Statics } from './Statics';


export interface ContainerClusterStackProps extends StackProps {

}

export class ContainerClusterStack extends Stack {

  constructor(scope: Construct, id: string, props: ContainerClusterStackProps) {
    super(scope, id, props);
    Aspects.of(this).add(new PermissionsBoundaryAspect());

    const vpc = this.setupVpc();

    // TODO: functions beter indelen
    const accountRootZoneId = ssm.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneId);
    const accountRootZoneName = ssm.StringParameter.valueForStringParameter(this, Statics.accountRootHostedZoneName);
    const accountRootZone = this.getAccountRootZone(accountRootZoneId, accountRootZoneName);
    const loadbalancer = this.setupLoadbalancer(vpc, accountRootZone);
    const listener = this.addListener(loadbalancer, accountRootZoneName, accountRootZone);

    const cluster = this.constructEcsCluster(vpc);
    const databaseSecret = this.setDatabaseSecretPass();
    const database = this.constructDatabase(vpc, databaseSecret);
    const service = this.addOpenFormsService(cluster, loadbalancer, listener, database, databaseSecret);
    database.postgresDatabase.connections.allowFrom(service.fargateService, Port.allTraffic());
  }

  setDatabaseSecretPass(): Secret {
    return new secrets.Secret(this, 'templated-secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"',
      },
    });
  }

  private setupVpc() {
    // Import vpc config

    const publicSubnetRouteTableIds = Array(3).fill(ssm.StringParameter.valueForStringParameter(this, '/platformunited/landing-zone/vpc/route-table-public-subnets-id'));


    //VPC setup for ECS cluster
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'vpc', {
      vpcId: ssm.StringParameter.valueForStringParameter(this, '/landingzone/vpc/vpc-id'),
      availabilityZones: [0, 1, 2].map(i => Fn.select(i, Fn.getAzs(Aws.REGION))),
      privateSubnetRouteTableIds: [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/route-table-private-subnet-${i}-id`)),
      publicSubnetRouteTableIds:
        publicSubnetRouteTableIds,
      publicSubnetIds: [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/public-subnet-${i}-id`)),
      privateSubnetIds: [1, 2, 3].map(i => ssm.StringParameter.valueForStringParameter(this, `/landingzone/vpc/private-subnet-${i}-id`)),
    });

    return vpc;
  }

  private constructEcsCluster(vpc: ec2.IVpc) {
    /**
     * Create an ECS cluster
     * By not providing a VPC we are creating a new VPC for this cluster
     */
    const cluster = new ecs.Cluster(this, 'cluster', {
      vpc,
      clusterName: 'openforms',
      enableFargateCapacityProviders: true, // Allows usage of spot instances
    });

    vpc.node.addDependency(cluster);

    return cluster;
  }

  private constructDatabase(vpc: ec2.IVpc, databaseSecret: secrets.Secret ) {
    const database = new Database(this, 'postgres_database', { vpc: vpc, databaseSecret: databaseSecret });
    return database;
  }

  private getAccountRootZone(accountRootZoneId: string, accountRootZoneName: string) {
    // Import account hosted zone
    const accountRootZone = route53.HostedZone.fromHostedZoneAttributes(this, 'account-root-zone', {
      hostedZoneId: accountRootZoneId,
      zoneName: accountRootZoneName,
    });

    return accountRootZone;
  }

  private setupLoadbalancer(vpc: ec2.IVpc, accountRootZone: route53.IHostedZone) {

    // Construct the loadbalancer
    const loadbalancer = new loadbalancing.ApplicationLoadBalancer(this, 'loadbalancer', {
      vpc,
      internetFacing: true, // Expose to internet (not internal to vpc)
    });
      // Security hub finding, do not accept invalid http headers
    loadbalancer.setAttribute('routing.http.drop_invalid_header_fields.enabled', 'true');

    new route53.ARecord(this, 'loadbalancer-a-record', {
      zone: accountRootZone,
      recordName: 'alb',
      target: route53.RecordTarget.fromAlias(new route53Targets.LoadBalancerTarget(loadbalancer)),
      comment: 'webformulieren load balancer a record',
    });

    vpc.node.addDependency(loadbalancer);
    return loadbalancer;
  }

  private addListener(loadbalancer: loadbalancing.IApplicationLoadBalancer, accountRootZoneName: string, accountRootZone: route53.IHostedZone) {

    // Get a certificate
    const albOpenFormsDomainName = `alb.${accountRootZoneName}`;
    const albCertificate = new acm.Certificate(this, 'loadbalancer-certificate', {
      domainName: albOpenFormsDomainName,
      validation: acm.CertificateValidation.fromDns(accountRootZone),
    });

    // Setup a https listener
    const listener = loadbalancer.addListener('https', {
      certificates: [albCertificate],
      protocol: loadbalancing.ApplicationProtocol.HTTPS,
      sslPolicy: loadbalancing.SslPolicy.FORWARD_SECRECY_TLS12_RES,
      defaultAction: loadbalancing.ListenerAction.fixedResponse(404, { messageBody: 'not found ALB' }),
    });

    return listener;
  }


  private addOpenFormsService(cluster: ecs.Cluster,
    loadbalancer: loadbalancing.IApplicationLoadBalancer,
    listener: loadbalancing.IApplicationListener,
    database: Database,
    databaseSecret: secrets.Secret,
  ) {
    const ecsFargateService = new EcsFargateService(this, 'service-fargate-open-forms-new', {
      serviceName: 'fargate-open-forms-new',
      containerImage: 'openformulieren/open-forms',
      containerPort: 8000,
      ecsCluster: cluster,
      loadbalancer: loadbalancer,
      listener: listener,
      serviceListenerPath: '/*',
      desiredtaskcount: 1,
      useSpotInstances: true,
      postgresDatabase: database.postgresDatabase,
      redisCluster: database.redisCluster,
      databaseSecret: databaseSecret,
    //   cloudfrontOnlyAccessToken: Statics.cloudfrontAlbAccessToken,
    });
    return ecsFargateService;
  }

}
