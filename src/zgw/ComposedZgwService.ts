import { aws_ec2 } from 'aws-cdk-lib';
import { ISecurityGroup, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { EfsVolumeConfiguration, FargateService } from 'aws-cdk-lib/aws-ecs';
import { AccessPoint, FileSystem } from 'aws-cdk-lib/aws-efs';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { ISecret, Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ZgwService } from './ZgwService';
import { ZgwCluster } from '../constructs/ZgwCluster';
import { Statics } from '../Statics';

export interface ComposedZgwServiceProps {

  /**
   * The cluster on which the service is deployed
   */
  zgwCluster: ZgwCluster;

  /**
   * Indicator if sport instances should be used for
   * running the tasks on fargate
   * @default false
   */
  useSpotInstances?: boolean;

  /**
   * Create file system
   */
  createFileSystem?: boolean;
}

export abstract class ComposedZgwService extends Construct {

  protected readonly props: ComposedZgwServiceProps;
  protected readonly databaseCredentials: ISecret;

  private readonly zgwServices: Record<string, ZgwService> = {};
  private privateFileSystemConfig?: EfsVolumeConfiguration;
  protected privateFileSystemSecurityGroup?: ISecurityGroup;
  protected fileSystemAccessPoint?: AccessPoint;
  protected fileSystem?: FileSystem;

  constructor(scope: Construct, id: string, props: ComposedZgwServiceProps) {
    super(scope, id);
    this.props = props;
    this.databaseCredentials = this.loadDatabaseCredentials();

    if (props.createFileSystem) {
      this.createFileSytem();
    }
  }

  abstract getEnvironmentConfiguration(): any;
  abstract getSecretConfiguration(): any;


  private loadDatabaseCredentials() {
    const arn = StringParameter.valueForStringParameter(this, Statics.ssmDbCredentialsArn);
    return Secret.fromSecretCompleteArn(this, 'db-credentials', arn);
  }

  protected setupServiceConnectivity(name: string, service: FargateService) {

    // Some very ugly code to allow this security group to connect to the db
    const dbSecurityGroupId = StringParameter.valueForStringParameter(this, Statics.ssmDbSecurityGroupId);
    const sg = SecurityGroup.fromSecurityGroupId(this, `${name}-db-sg`, dbSecurityGroupId);
    const dbport = StringParameter.valueForStringParameter(this, Statics.ssmDbPort);
    service.connections.securityGroups.forEach(serviceSg => sg.addIngressRule(serviceSg, Port.tcp(dbport as any as number))); // Hack to pass token as number

    // Allow container to talk to redis
    const redisPort = this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort;
    this.props.zgwCluster.redis.redisCluster.vpcSecurityGroupIds?.forEach((redisSgId, index) => {
      const redisSg = SecurityGroup.fromSecurityGroupId(this, `${name}-db-redis-sg-${index}`, redisSgId);
      service.connections.securityGroups.forEach(serviceSg => redisSg.addIngressRule(serviceSg, Port.tcp(redisPort as any as number))); // Hack to pass token as number
    });

    return service;
  }


  protected allowAccessToSecrets(service: FargateService) {
    // TODO figure out which of these two is effective currently...
    service.taskDefinition.addToExecutionRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'secretsmanager:GetSecretValue',
      ],
      resources: [
        this.databaseCredentials.secretArn,
      ],
    }));
    this.databaseCredentials.grantRead(service.taskDefinition.executionRole!);
  }

  protected createFileSytem() {
    this.privateFileSystemSecurityGroup = new aws_ec2.SecurityGroup(this, 'efs-security-group', {
      vpc: this.props.zgwCluster.vpc,
    });

    this.fileSystem = new FileSystem(this, 'EfsFileSystem', {
      encrypted: true,
      vpc: this.props.zgwCluster.vpc,
      securityGroup: this.privateFileSystemSecurityGroup,
    });

    this.fileSystemAccessPoint = new AccessPoint(this, 'volumeAccessPoint', {
      fileSystem: this.fileSystem,

      path: '/data',
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '755',
      },
      posixUser: {
        uid: '1000',
        gid: '1000',
      },
    });

    this.privateFileSystemConfig = {
      authorizationConfig: {
        accessPointId: this.fileSystemAccessPoint.accessPointId,
        iam: 'ENABLED',
      },
      fileSystemId: this.fileSystem.fileSystemId,
      transitEncryption: 'ENABLED',
    };
  }

  protected registerZgwService(name: string, zgwService: ZgwService) {
    this.zgwServices[name] = zgwService;

    if (this.props.createFileSystem) {
      const mediaVolume = {
      // Use an Elastic FileSystem
        name: 'media',
        efsVolumeConfiguration: this.privateFileSystemConfig,
      };

      const privateMediaVolume = {
      // Use an Elastic FileSystem
        name: 'private_media',
        efsVolumeConfiguration: this.privateFileSystemConfig,
      };

      zgwService.service.taskDefinition.addVolume(mediaVolume);
      zgwService.service.taskDefinition.defaultContainer?.addMountPoints({
        readOnly: false,
        containerPath: '/app/media',
        sourceVolume: mediaVolume.name,
      });

      zgwService.service.taskDefinition.addVolume(privateMediaVolume);
      zgwService.service.taskDefinition.defaultContainer?.addMountPoints({
        readOnly: false,
        containerPath: '/app/private_media',
        sourceVolume: privateMediaVolume.name,
      });

      zgwService.service.connections.securityGroups.forEach(sg => {
        this.privateFileSystemSecurityGroup?.addIngressRule(sg, Port.NFS);
      });
    }

    this.allowAccessToSecrets(zgwService.service);
    this.setupServiceConnectivity(name, zgwService.service);
  }

  getZgwService(name: string) {
    return this.zgwServices[name];
  }

}