import {
  aws_logs as logs,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import { ZgwCluster } from './ZgwCluster';

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


}


/**
 * The ecs fargate service construct:
 * - defines a service with a single task
 * - the task consists of a single container
 * - creates a log group for the service
 * - exposes a single container port to the loadbalancer over http
 */
export class ZgwService extends Construct {

  readonly logGroupArn: string;
  readonly fargateService: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ZgwServiceProps) {
    super(scope, id);

    // Logging
    const logGroup = this.logGroup();
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
  private setupLoadbalancerTarget(service: ecs.FargateService, props: ZgwServiceProps) {
    const pathWithSlash = `/${props.path}`;
    props.zgwCluster.alb.listener.addTargets('target', {
      port: props.containerPort,
      targets: [service],
      conditions: [
        ListenerCondition.pathPatterns([pathWithSlash]),
      ],
      priority: 10,
      healthCheck: {
        enabled: true,
        path: pathWithSlash,
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
  private setupTaskDefinition(logGroup: logs.ILogGroup, props: ZgwServiceProps) {

    const taskDef = new ecs.TaskDefinition(this, 'task', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512', // TODO Uses minimal cpu and memory
      memoryMiB: '2048',
    });

    taskDef.addContainer('main-container', {
      image: ecs.ContainerImage.fromRegistry(props.containerImage),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: props.containerPort,
      }],
      environment: {},
    });

    return taskDef;
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

    return service;
  }

}