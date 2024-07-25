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
export class ObjectsServiceCelery extends Construct {

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
      DJANGO_SETTINGS_MODULE: 'objects.conf.docker',
      DB_NAME: 'objects',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      ALLOWED_HOSTS: '*', // See loadbalancer target remark above this.props.zgwCluster.alb.getDomain(),
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/4',
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/4',
      SUBPATH: '/objects',
      IS_HTTPS: 'True',
      UWSGI_PORT: '8080',

      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'False',
      DEBUG: 'True',

      // Required demo stuff?
      DEMO_TOKEN: 'DemoToken',
      DEMO_PERSON: 'DemoPerson',
      DEMO_EMAIL: 'objects@objects.local',

      OBJECTS_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      OBJECTS_ORGANIZATION: 'OZ',
      OBJECTS_OBJECTTYPES_TOKEN: 'some-random-string',
      OBJECTTYPES_API_ROOT: `https://${this.props.zgwCluster.alb.getDomain()}/objecttypes/api/v2/`,

      // Setup admin user on boot
      OBJECTS_SUPERUSER_USERNAME: 'admin',
      OBJECTS_SUPERUSER_PASSWORD: 'admin',

      // Celery
      CELERY_BROKER_URL: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/5',
      CELERY_RESULT_BACKEND: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/5',
      CELERY_LOGLEVEL: 'DEBUG',

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
      image: ecs.ContainerImage.fromRegistry('maykinmedia/objects-api'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: 8080,
      }],
      command: ['/celery_worker.sh'],
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