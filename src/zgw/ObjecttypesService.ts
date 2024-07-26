import {
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ComposedZgwService, ComposedZgwServiceProps } from './ComposedZgwService';
import { ZgwService } from './ZgwService';
import { Statics } from '../Statics';

export interface ObjecttypesServiceProps extends ComposedZgwServiceProps {}

export class ObjecttypesService extends ComposedZgwService {

  private static readonly PORT = 8080;

  constructor(scope: Construct, id: string, props: ObjecttypesServiceProps) {
    super(scope, id, props);


    this.registerZgwService(
      'objecttypes',
      new ZgwService(this, 'objecttypes', {
        containerImage: 'maykinmedia/objecttypes-api',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        expose: {
          path: 'objecttypes',
          port: ObjecttypesService.PORT,
          priority: 21, // Note must be unique across all alb rules
        },
        initContainerCommand: ['/setup_configuration.sh'],
      }),
    );

  }

  getEnvironmentConfiguration() {
    const environment = {
      DJANGO_SETTINGS_MODULE: 'objecttypes.conf.docker',
      DB_NAME: 'objecttypes',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      ALLOWED_HOSTS: '*', // See loadbalancer target remark above this.props.zgwCluster.alb.getDomain(),
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/3',
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/3',
      SUBPATH: '/objecttypes',
      IS_HTTPS: 'True',
      UWSGI_PORT: ObjecttypesService.PORT.toString(),

      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'False',
      DEBUG: 'True',

      // Required demo stuff?
      DEMO_TOKEN: 'DemoToken',
      DEMO_PERSON: 'DemoPerson',
      DEMO_EMAIL: 'objects@objects.local',

      OBJECTTYPES_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      OBJECTTYPES_ORGANIZATION: 'OZ',
      OBJECTS_OBJECTTYPES_TOKEN: 'some-random-string',
      OBJECTS_OBJECTTYPES_PERSON: 'Some Person',
      OBJECTS_OBJECTTYPES_EMAIL: 'objects@objects.local',

      // Setup admin user on boot
      OBJECTTYPE_SUPERUSER_USERNAME: 'admin',
      OBJECTTYPE_SUPERUSER_PASSWORD: 'admin',

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