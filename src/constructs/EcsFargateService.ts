import {
  aws_logs as logs,
  aws_ecs as ecs,
  aws_secretsmanager as secrets,
  aws_elasticloadbalancingv2 as loadbalancing,
  aws_rds as rds,
  aws_elasticache as redis,
} from 'aws-cdk-lib';
import { Port } from 'aws-cdk-lib/aws-ec2';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Statics } from '../Statics';

export interface EcsFargateServiceProps {
  /**
     * The name of this ECS fargate service.
     * A service suffix is automatically added.
     */
  serviceName: string;

  /**
     * The ECS cluster to which to add this fargate service
     */
  ecsCluster: ecs.Cluster;

  /**
     * The loadbalancer to which to connect this service
     */
  loadbalancer: loadbalancing.IApplicationLoadBalancer;

  /**
     * The loadbalancer to which to connect this service
     */
  listener: loadbalancing.IApplicationListener;

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
     * Service listner path
     * (i.e. the path that the loadbalancer will use for this service)
     * Example: '/api/*'
     */
  serviceListenerPath: string;

  /**
     * Indicator if sport instances should be used for
     * running the tasks on fargate
     */
  useSpotInstances?: boolean;

  /**
     * Set a token that must be send using the
     * X-Cloudfront-Access-Token header from cloudfront to allow the
     * request to pass trough the loadbalancer.
     */
  cloudfrontOnlyAccessToken?: string;

  /**
   * Postgres database
   */
  postgresDatabase: rds.DatabaseInstance;

  /**
   * Redis cluster
   */
  redisCluster: redis.CfnCacheCluster;

  /**
   * Database Secret containing username and pass
   */
  databaseSecret: secrets.Secret;

}


/**
   * The ecs fargate service construct:
   * - defines a service with a single task
   * - the task consists of a single container
   * - creates a log group for the service
   * - exposes a single container port to the loadbalancer over http
   */
export class EcsFargateService extends Construct {

  readonly logGroupArn: string;
  readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: EcsFargateServiceProps) {
    super(scope, id);

    // Logging
    const logGroup = this.logGroup(props);
    this.logGroupArn = logGroup.logGroupArn;

    // Task, service and expose to loadbalancer
    const task = this.setupTaskDefinition(logGroup, props);
    const service = this.setupFargateService(task, props);
    this.fargateService = service;
    this.setupLoadbalancerTarget(service, props);

  }


  /**
     * Exposes the service to the loadbalancer listner on a given path and port
     * @param service
     * @param props
     */
  private setupLoadbalancerTarget(service: ecs.FargateService, props: EcsFargateServiceProps) {

    const conditions = [
      loadbalancing.ListenerCondition.pathPatterns([props.serviceListenerPath]),
    ];
    // if (props.cloudfrontOnlyAccessToken) {
    //   // conditions.push(loadbalancing.ListenerCondition.httpHeader('X-Cloudfront-Access-Token', [Statics.cloudfrontAlbAccessToken]));
    // }

    props.listener.addTargets(`${props.serviceName}-target`, {
      port: props.containerPort,
      protocol: loadbalancing.ApplicationProtocol.HTTP,
      targets: [service],
      conditions,
      priority: 10,
      healthCheck: {
        enabled: true,
        path: '/admin',
        healthyHttpCodes: '200,400', // TODO when running remove port 400
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
  private logGroup(props: EcsFargateServiceProps) {
    const logGroup = new logs.LogGroup(this, `${props.serviceName}-logs`, {
      retention: logs.RetentionDays.ONE_DAY, // TODO Very short lived (no need to keep demo stuff)
    });
    return logGroup;
  }

  /**
     * Create a task definition with a single container for
     * within the fargate service
     * @param props
     */
  private setupTaskDefinition(logGroup: logs.ILogGroup, props: EcsFargateServiceProps) {
    // const dockerhubCredentials = secrets.Secret.fromSecretNameV2(this, 'dockerhub_credentials', Statics.secretDockerhubCredentials);
    // const emailSmtpUsernameSecret = secrets.Secret.fromSecretNameV2(this, 'smtp_username', Statics.secretEmailUsername).secretValue.toString();
    // const emailSmtpPasswordSecret = secrets.Secret.fromSecretNameV2(this, 'smtp_password', Statics.secretEmailPassword).secretValue.toString();
    // const dockerhubCredentials = secrets.Secret.fromSecretCompleteArn(this, 'dockerhub_credentials', Statics.secretDockerhubCredentialsArn);

    const emailSmtpUsernameSecret = secrets.Secret.fromSecretCompleteArn(this, 'smtp_username', Statics.secretEmailUsernameArn).secretValue.toString();
    const emailSmtpPasswordSecret = secrets.Secret.fromSecretCompleteArn(this, 'smtp_password', Statics.secretEmailPasswordArn).secretValue.toString();

    const taskDef = new ecs.TaskDefinition(this, `${props.serviceName}-task-new`, {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512', // TODO Uses minimal cpu and memory
      memoryMiB: '2048',
    });

    taskDef.addContainer(`${props.serviceName}-container`, {
      image: ecs.ContainerImage.fromRegistry(props.containerImage,
        // { credentials: dockerhubCredentials }
      ),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: props.containerPort,
      }],
      environment: {
        DJANGO_SETTINGS_MODULE: 'openforms.conf.docker',
        EMAIL_HOST: 'email-smtp.eu-central-1.amazonaws.com',
        EMAIL_PORT: '25',
        EMAIL_HOST_USER: emailSmtpUsernameSecret,
        EMAIL_HOST_PASSWORD: emailSmtpPasswordSecret,
        EMAIL_USE_TLS: 'True',
        DEFAULT_FROM_EMAIL: 'test@sandbox-01.csp-nijmegen.nl',
        SECRET_KEY: 'hx*gr9j-y*0gm@^vd--w^qyg^k_brhu2)yej%g8qzs=b#h+bpa', // TODO: secret van maken
        BASE_URL: 'https://alb.sandbox-01.csp-nijmegen.nl', // TODO: wijzigen door op te halen met loadbalancer / account props
        DB_HOST: props.postgresDatabase.instanceEndpoint.hostname,
        DB_PORT: props.postgresDatabase.instanceEndpoint.port.toString(),
        DB_USER: 'postgres',
        DB_PASSWORD: props.databaseSecret.secretValueFromJson('password').toString(),
        DB_NAME: 'openforms',
        ALLOWED_HOSTS: 'alb.sandbox-01.csp-nijmegen.nl',
        CELERY_BROKER_URL: 'redis://'+ props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        CELERY_RESULT_BACKEND: 'redis://'+ props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        CACHE_DEFAULT: props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        CACHE_PORTALOCKER: props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        CACHE_AXES: props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        CACHE_OIDC: props.redisCluster.attrRedisEndpointAddress + ':' + props.redisCluster.attrRedisEndpointPort,
        DEBUG: 'True',
        TWO_FACTOR_FORCE_OTP_ADMIN: 'False',
        LOG_STD_OUT: 'True', // Set to default True setting to trigger deploy changes

      }, //TODO: verhuizen om container generieker aan te kunnen maken
    }).taskDefinition.addToTaskRolePolicy(new PolicyStatement({
      actions: [
        'ssm:GetParameters',
        'secretsmanager:GetSecretValue',
        'kms:Decrypt',
      ],
      resources: ['*'], // TODO stricter?
    }));
    return taskDef;
  }

  /**
     * Define the service in the cluster
     * @param task the ecs task definition
     * @param props
     */
  private setupFargateService(task: ecs.TaskDefinition, props: EcsFargateServiceProps) {
    const service = new ecs.FargateService(this, `${props.serviceName}-service`, {
      cluster: props.ecsCluster,
      serviceName: `${props.serviceName}-service`,
      taskDefinition: task,
      desiredCount: props.desiredtaskcount,
      capacityProviderStrategies: [
        {
          capacityProvider: props.useSpotInstances ? 'FARGATE_SPOT' : 'FARGATE',
          weight: 1,
        },
      ],
    });
    service.node.addDependency(props.ecsCluster);

    service.connections.allowFrom(props.postgresDatabase, Port.allTraffic());
    return service;
  }

}