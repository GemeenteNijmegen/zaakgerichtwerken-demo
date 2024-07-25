import {
  aws_logs as logs,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ZgwCluster } from '../constructs/ZgwCluster';

export interface RabbitMQServiceProps {

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
export class RabbitMQService extends Construct {

  readonly logGroupArn: string;
  readonly fargateService: ecs.FargateService;

  private readonly props: RabbitMQServiceProps;

  constructor(scope: Construct, id: string, props: RabbitMQServiceProps) {
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
      // Port?

    };


    const mainTaks = new ecs.TaskDefinition(this, 'main-task', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: '512', // TODO Uses minimal cpu and memory
      memoryMiB: '2048',
    });

    mainTaks.addContainer('main', {
      image: ecs.ContainerImage.fromRegistry('rabbitmq:3.13.4-alpine'),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      portMappings: [{
        containerPort: 5672,
      }],
      environment: environment,
    });

    return mainTaks;
  }

  /**
   * Define the service in the cluster
   * @param task the ecs task definition
   * @param props
   */
  private setupFargateService(task: ecs.TaskDefinition, props: RabbitMQServiceProps) {
    const service = new ecs.FargateService(this, 'service', {
      cluster: props.zgwCluster.cluster.cluster,
      taskDefinition: task,
      desiredCount: props.desiredtaskcount,
      capacityProviderStrategies: [
        {
          capacityProvider: this.props.useSpotInstances ? 'FARGATE_SPOT' : 'FARGATE',
          weight: 1,
        },
      ],
      cloudMapOptions: {
        name: 'rabbitmq',
      },
    });
    service.node.addDependency(props.zgwCluster.cluster.cluster);


    // TODO Allow communication to this container?

    return service;
  }

}