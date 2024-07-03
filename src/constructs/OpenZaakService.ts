import {
  aws_logs as logs,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ZgwCluster } from './ZgwCluster';
import { Statics } from '../Statics';

export interface ZgwServiceProps {

  /**
   * The cluster on which the service is deployed
   */
  zgwCluster: ZgwCluster;

  /**
   * Desired numer of tasks that should run in this service.
   */
  desiredtaskcount?: number;

  /**
   * The container image to use (e.g. on dockerhub)
   */
  containerImage: string;

  /**
   * Container listing port
   */
  containerPort: number;

  /**
   * Path that is used behind the loadbalancer
   */
  path: string;

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   * @default false
   */
  useSpotInstances?: boolean;

  /**
   * Provide a unique priority for the rule in the alb....
   */
  priority: number;

}


/**
 * The ecs fargate service construct:
 * - defines a service with a single task
 * - the task consists of a single container
 * - creates a log group for the service
 * - exposes a single container port to the loadbalancer over http
 */
export class OpenZaakService extends Construct {

  readonly logGroupArn: string;
  readonly fargateService: ecs.FargateService;

  private readonly props: ZgwServiceProps;

  constructor(scope: Construct, id: string, props: ZgwServiceProps) {
    super(scope, id);
    this.props = props;

    // Logging
    const logGroup = this.logGroup();
    this.logGroupArn = logGroup.logGroupArn;

    // Task, service and expose to loadbalancer
    const task = this.setupTaskDefinition(logGroup);
    const service = this.setupFargateService(task, props);
    this.fargateService = service;
    this.setupLoadbalancerTarget(service, props);

  }

  /**
   * Exposes the service to the loadbalancer listner on a given path and port
   * @param service
   * @param props
   */
  private setupLoadbalancerTarget(service: ecs.FargateService, props: ZgwServiceProps) {
    const pathWithSlash = `/${props.path}`;
    props.zgwCluster.alb.listener.addTargets(this.node.id, {
      port: props.containerPort,
      targets: [service],
      conditions: [
        ListenerCondition.pathPatterns([pathWithSlash + '/*']),
      ],
      priority: 11,
      healthCheck: {
        enabled: true,
        path: '/open-zaak/admin/login',
        healthyHttpCodes: '200,400', // TODO when running remove code 400
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 6,
        port: props.containerPort.toString(),
      },
    });
  }


  /**
   * Setup a basic log group for this service's logs
   * @param props
   */
  private logGroup() {
    const logGroup = new logs.LogGroup(this, 'logs', {
      retention: logs.RetentionDays.ONE_DAY, // TODO Very short lived (no need to keep demo stuff)
    });
    return logGroup;
  }

  /**
   * Create a task definition with a single container for
   * within the fargate service
   * @param props
   */
  private setupTaskDefinition(logGroup: logs.ILogGroup) {

    const environment = {
      DJANGO_SETTINGS_MODULE: 'openzaak.conf.docker',
      DB_NAME: Statics.databaseName,
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      IS_HTTPS: 'no',
      ALLOWED_HOSTS: this.props.zgwCluster.alb.getDomain(),
      CORS_ALLOW_ALL_ORIGINS: 'True',
      CSRF_TRUSTED_ORIGINS: `https://${this.props.zgwCluster.alb.getDomain()}`,
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      SUBPATH: '/open-zaak',
      // IMPORT_DOCUMENTEN_BASE_DIR=${IMPORT_DOCUMENTEN_BASE_DIR:-/app/import-data}
      // IMPORT_DOCUMENTEN_BATCH_SIZE=${IMPORT_DOCUMENTEN_BATCH_SIZE:-500}
      OPENZAAK_SUPERUSER_USERNAME: 'admin',
      DJANGO_SUPERUSER_PASSWORD: 'admin',
      OPENZAAK_SUPERUSER_EMAIL: 'admin@localhost',
      CELERY_BROKER_URL: 'redis://'+ this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/1',
      CELERY_RESULT_BACKEND: 'redis://'+ this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/1',
      CELERY_LOGLEVEL: 'DEBUG',
      CELERY_WORKER_CONCURRENCY: '4',

      // Openzaak specific stuff
      OPENZAAK_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      OPENZAAK_ORGANIZATION: 'OZ',
      DEMO_CONFIG_ENABLE: 'yes',
      DEMO_CLIENT_ID: 'demo-client-id',
      DEMO_SECRET: 'demo-secret',

      UWSGI_PORT: this.props.containerPort.toString(),

      // Waarom zit hier notify spul in?
      // - NOTIF_OPENZAAK_CLIENT_ID=notif-client-id
      // - NOTIF_OPENZAAK_SECRET=notif-secret
      // - NOTIF_API_ROOT=http://notifications:8000/api/v1/
      // - OPENZAAK_NOTIF_CLIENT_ID=oz-client-id
      // - OPENZAAK_NOTIF_SECRET=oz-secret
    };

    const secretKey = this.secretKey();
    const dbCredentials = this.dbCredentials();

    const secrets = {
      SECRET_KEY: ecs.Secret.fromSecretsManager(secretKey),
      DB_PASSWORD: ecs.Secret.fromSecretsManager(dbCredentials, 'password'),
      DB_USER: ecs.Secret.fromSecretsManager(dbCredentials, 'username'),
    };

    const mainTaks = new ecs.TaskDefinition(this, 'main-task', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512', // TODO Uses minimal cpu and memory
      memoryMiB: '2048',
    });

    mainTaks.addContainer('main', {
      image: ecs.ContainerImage.fromRegistry('openzaak/open-zaak'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: 8080,
      }],
      environment: environment,
      secrets: secrets,
    });

    mainTaks.addToExecutionRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        dbCredentials.secretArn,
      ],
    }));

    secretKey.grantRead(mainTaks.taskRole);
    dbCredentials.grantRead(mainTaks.executionRole!);

    return mainTaks;
  }

  private dbCredentials() {
    const arn = StringParameter.valueForStringParameter(this, Statics.ssmDbCredentialsArn);
    return Secret.fromSecretCompleteArn(this, 'db-credentials', arn);
  }

  private secretKey() {
    return new Secret(this, 'secret-key');
  }

  /**
   * Define the service in the cluster
   * @param task the ecs task definition
   * @param props
   */
  private setupFargateService(task: ecs.TaskDefinition, props: ZgwServiceProps) {
    const service = new ecs.FargateService(this, 'service', {
      cluster: props.zgwCluster.cluster.cluster,
      taskDefinition: task,
      desiredCount: props.desiredtaskcount,
      capacityProviderStrategies: [
        {
          capacityProvider: props.useSpotInstances ? 'FARGATE_SPOT' : 'FARGATE',
          weight: 1,
        },
      ],
    });
    service.node.addDependency(props.zgwCluster.cluster.cluster);

    // Some very ugly code to allow this security group to connect to the db
    const dbSecurityGroupId = StringParameter.valueForStringParameter(this, Statics.ssmDbSecurityGroupId);
    const sg = SecurityGroup.fromSecurityGroupId(this, 'db-sg', dbSecurityGroupId);
    // const dbport = StringParameter.valueForStringParameter(this, Statics.ssmDbPort);
    service.connections.securityGroups.forEach(serviceSg => sg.addIngressRule(serviceSg, Port.tcp(5432))); // TODO figure out how to import this

    return service;
  }

}