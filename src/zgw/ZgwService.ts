import {
  aws_logs as logs,
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { ContainerDependencyCondition } from 'aws-cdk-lib/aws-ecs';
import { ApplicationProtocol, ListenerCondition } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { ZgwCluster } from '../constructs/ZgwCluster';

export interface ZgwServiceProps {

  /**
   * The cluster on which the service is deployed
   */
  zgwCluster: ZgwCluster;

  /**
   * Container image to run the service/
   */
  containerImage: string;

  /**
   * Desired numer of tasks that should run in this service.
   * @default 1
   */
  desiredtaskcount?: number;

  /**
   * @default - Service is not exposed on the loadbalancer
   */
  expose?: {
    /**
     * Path that is used behind the loadbalancer
     */
    path: string;
    /**
     * Provide a unique priority for the rule in the alb....
     */
    priority: number;
    /**
     * Container port to which the loadbalancer will route traffic
     */
    port: number;
  };

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   * @default true
   */
  useSpotInstances?: boolean;

  environment: any;
  secrets: any;

  /**
   * @default 512
   */
  cpu?: number;
  /**
   * @default 1024
   */
  memory?: number;

  /**
   * Command to run for the init container (uses same image as service)
   * @default - no init container
   */
  initContainerCommand?: string[];

  /**
   * The secret that contains the database credentials
   * Username and password as json.
   */
  databaseCredentials: ISecret;

  /**
   * Overwrite the default image command
   */
  command?: string[];
}


export class ZgwService extends Construct {

  readonly logGroupArn: string;
  readonly service: ecs.FargateService;
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
    this.service = service;

    if (props.expose) {
      this.setupLoadbalancerTarget(props);
    }

  }

  /**
   * Exposes the service to the loadbalancer listner on a given path and port
   * @param service
   * @param props
   */
  private setupLoadbalancerTarget(props: ZgwServiceProps) {
    if (!props.expose) {
      throw Error('Expose configuration should be set for ZgwService');
    }
    const pathWithSlash = `/${props.expose.path}`;
    props.zgwCluster.alb.listener.addTargets(this.node.id, {
      port: props.expose?.port,
      protocol: ApplicationProtocol.HTTP,
      targets: [this.service],
      conditions: [
        ListenerCondition.pathPatterns([pathWithSlash + '/*']),
      ],
      priority: props.expose.priority,
      healthCheck: {
        enabled: true,
        path: pathWithSlash,
        healthyHttpCodes: '200,400,301,404', // See this acticle for allowing the 400 response... https://medium.com/django-unleashed/djangos-allowed-hosts-in-aws-ecs-369959f2c2ab
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 6,
        port: props.expose.path.toString(),
      },
    });
  }

  /**
   * Setup a basic log group for this service's logs
   * @param props
   */
  private logGroup() {
    const logGroup = new logs.LogGroup(this, 'logs', {
      retention: logs.RetentionDays.ONE_WEEK,
    });
    return logGroup;
  }

  /**
   * Create a task definition
   * Includes an init container if an init command is provided
   * Only adds a port mapping if the expose configuration is provided
   */
  private setupTaskDefinition(logGroup: logs.ILogGroup) {

    const mainTaks = new ecs.TaskDefinition(this, 'main-task', {
      compatibility: ecs.Compatibility.FARGATE,
      cpu: this.props.cpu?.toString() ?? '512',
      memoryMiB: this.props.memory?.toString() ?? '1024',
    });

    // Create a secret key and add it to the secres provied
    const secretKey = this.secretKey();
    secretKey.grantRead(mainTaks.taskRole);
    const secrets = {
      ...this.props.secrets,
      SECRET_KEY: ecs.Secret.fromSecretsManager(secretKey),
    };

    const main = mainTaks.addContainer('main', {
      image: ecs.ContainerImage.fromRegistry(this.props.containerImage),
      logging: new ecs.AwsLogDriver({
        streamPrefix: 'logs',
        logGroup: logGroup,
      }),
      environment: this.props.environment,
      secrets: secrets,
      command: this.props.command,
    });

    if (this.props.expose) {
      main.addPortMappings({
        containerPort: this.props.expose.port,
      });
    }

    if (this.props.initContainerCommand) {
      const init = mainTaks.addContainer('init', {
        image: ecs.ContainerImage.fromRegistry(this.props.containerImage),
        logging: new ecs.AwsLogDriver({
          streamPrefix: 'logs',
          logGroup: logGroup,
        }),
        environment: this.props.environment,
        secrets: secrets,
        entryPoint: this.props.initContainerCommand,
        essential: false,
      });
      main.addContainerDependencies({
        container: init,
        condition: ContainerDependencyCondition.SUCCESS,
      });
    }

    return mainTaks;
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
      desiredCount: props.desiredtaskcount ?? 1,
      capacityProviderStrategies: [
        {
          capacityProvider: props.useSpotInstances == false ? 'FARGATE' : 'FARGATE_SPOT',
          weight: 1,
        },
      ],
    });
    return service;
  }

}