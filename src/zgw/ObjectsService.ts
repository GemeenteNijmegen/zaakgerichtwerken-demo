import {
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ComposedZgwService, ComposedZgwServiceProps } from './ComposedZgwService';
import { ZgwService } from './ZgwService';
import { Statics } from '../Statics';

export interface ObjectsServiceProps extends ComposedZgwServiceProps {}

export class ObjectsService extends ComposedZgwService {

  private static readonly PORT = 8080;

  constructor(scope: Construct, id: string, props: ObjectsServiceProps) {
    super(scope, id, props);


    this.registerZgwService(
      'objects',
      new ZgwService(this, 'objects', {
        containerImage: 'maykinmedia/objects-api',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        expose: {
          path: 'objects',
          port: ObjectsService.PORT,
          priority: 20, // Note must be unique across all alb rules
        },
        initContainerCommand: ['/setup_configuration.sh'],
      }),
    );

    this.registerZgwService(
      'objects-celery',
      new ZgwService(this, 'objects-celery', {
        containerImage: 'maykinmedia/objects-api',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        command: ['/celery_worker.sh'],
      }),
    );

  }

  getEnvironmentConfiguration() {
    const environment = {
      DJANGO_SETTINGS_MODULE: 'objects.conf.docker',
      DB_NAME: 'objects',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      ALLOWED_HOSTS: '*', // See loadbalancer target remark above this.props.zgwCluster.alb.getDomain(),
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/objects-cache',
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/objects-cache',
      SUBPATH: '/objects',
      IS_HTTPS: 'True',
      UWSGI_PORT: ObjectsService.PORT.toString(),

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
      CELERY_BROKER_URL: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/objects-celery',
      CELERY_RESULT_BACKEND: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/objects-celery',
      CELERY_LOGLEVEL: 'DEBUG',

    };
    return environment;
  }

  getSecretConfiguration() {
    const secrets = {
      DB_PASSWORD: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password'),
      DB_USER: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username'),
    };
    return secrets;
  }

}