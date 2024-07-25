import {
  aws_logs as logs,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ZgwCluster } from '../constructs/ZgwCluster';
import { Statics } from '../Statics';

export interface OpenNotificatiesServiceProps {

  /**
   * The cluster on which the service is deployed
   */
  zgwCluster: ZgwCluster;

  /**
   * Desired numer of tasks that should run in this service.
   */
  desiredtaskcount?: number;

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   * @default false
   */
  useSpotInstances?: boolean;

}


/**
 * The ecs fargate service construct:
 * - defines a service with a single task
 * - the task consists of a single container
 * - creates a log group for the service
 * - exposes a single container port to the loadbalancer over http
 */
export class OpenNotificatiesServiceCelaryBeat extends Construct {

  readonly logGroupArn: string;
  readonly fargateService: ecs.FargateService;

  private readonly props: OpenNotificatiesServiceProps;

  constructor(scope: Construct, id: string, props: OpenNotificatiesServiceProps) {
    super(scope, id);
    this.props = props;

    // Logging
    const logGroup = this.logGroup();
    this.logGroupArn = logGroup.logGroupArn;

    // Task, service and expose to loadbalancer
    const task = this.setupTaskDefinition(logGroup);
    const service = this.setupFargateService(task, props);
    this.fargateService = service;

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
      DJANGO_SETTINGS_MODULE: 'nrc.conf.docker',
      DB_NAME: 'opennotificaties',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      IS_HTTPS: 'yes',
      ALLOWED_HOSTS: this.props.zgwCluster.alb.getDomain(),
      CORS_ALLOW_ALL_ORIGINS: 'True',
      CSRF_TRUSTED_ORIGINS: `https://${this.props.zgwCluster.alb.getDomain()}/open-notificaties`,
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      SUBPATH: '/open-notificaties',
      OPENNOTIFICATIES_SUPERUSER_USERNAME: 'admin',
      OPENNOTIFICATIES_SUPERUSER_EMAIL: 'admin@localhost',
      DJANGO_SUPERUSER_PASSWORD: 'admin',
      CELERY_RESULT_BACKEND: 'redis://'+ this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/2',
      CELERY_LOGLEVEL: 'DEBUG',
      CELERY_WORKER_CONCURRENCY: '4',

      RABBITMQ_HOST: 'rabbitmq.zgw.local',
      PUBLISH_BROKER_URL: 'amqp://guest:guest@rabbitmq.zgw.local:5672/%2F',
      CELERY_BROKER_URL: 'amqp://guest:guest@rabbitmq.zgw.local:5672//',
      OPENNOTIFICATIES_ORGANIZATION: 'ON',
      OPENNOTIFICATIES_DOMAIN: `https://${this.props.zgwCluster.alb.getDomain()}/open-notificaties`,

      // Openzaak specific stuff
      // OPENZAAK_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      // OPENZAAK_ORGANIZATION: 'OZ',
      DEMO_CONFIG_ENABLE: 'yes',
      DEMO_CLIENT_ID: 'demo-client-id',
      DEMO_SECRET: 'demo-secret',

      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'True',
      DEBUG: 'True',

      // Waarom zit hier notify spul in? (1 juli)
      // Ah, dit gaat over de notificatie api en openzaak api zodat die met elkaar kunnen praten... (3 juli)
      // Dit toevoegen doet niets in de applicaties (9 juli), configuratie via de UI gedaan
      // Dit werkt voor het script setup_configuration.sh (12 juli)
      NOTIF_OPENZAAK_CLIENT_ID: 'notificaties-client',
      NOTIF_OPENZAAK_SECRET: 'notificaties-secret',
      AUTORISATIES_API_ROOT: 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/autorisaties/api/v1',
      OPENZAAK_NOTIF_CLIENT_ID: 'oz-client',
      OPENZAAK_NOTIF_SECRET: 'oz-secret',
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
      image: ecs.ContainerImage.fromRegistry('openzaak/open-notificaties'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: 8095,
      }],
      environment: environment,
      command: ['/celery_beat.sh'],
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
  private setupFargateService(task: ecs.TaskDefinition, props: OpenNotificatiesServiceProps) {
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
    const dbport = StringParameter.valueForStringParameter(this, Statics.ssmDbPort);
    service.connections.securityGroups.forEach(serviceSg => sg.addIngressRule(serviceSg, Port.tcp(dbport as any as number))); // Hack to pass token as number

    // Allow container to talk to redis
    const redisPort = this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort;
    props.zgwCluster.redis.redisCluster.vpcSecurityGroupIds?.forEach((redisSgId, index) => {
      const redisSg = SecurityGroup.fromSecurityGroupId(this, `db-redis-sg-${index}`, redisSgId);
      service.connections.securityGroups.forEach(serviceSg => redisSg.addIngressRule(serviceSg, Port.tcp(redisPort as any as number))); // Hack to pass token as number
    });


    return service;
  }

}