import {
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ComposedZgwService, ComposedZgwServiceProps } from './ComposedZgwService';
import { ZgwService } from './ZgwService';
import { Statics } from '../Statics';

export interface OpenNotificatiesServiceProps extends ComposedZgwServiceProps {}

export class OpenNotificatiesService extends ComposedZgwService {

  private static readonly PORT = 8080;

  constructor(scope: Construct, id: string, props: OpenNotificatiesServiceProps) {
    super(scope, id, props);


    this.registerZgwService(
      'open-notificaties',
      new ZgwService(this, 'open-notificaties', {
        containerImage: 'openzaak/open-notificaties',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        expose: {
          path: 'open-notificaties',
          port: OpenNotificatiesService.PORT,
          priority: 23, // Note must be unique across all alb rules
        },
        initContainerCommand: ['/setup_configuration.sh'],
        // cpu: 1024, // Having problems with this container currently...
      }),
    );

    this.registerZgwService(
      'open-notificaties-celery',
      new ZgwService(this, 'open-notificaties-celery', {
        containerImage: 'openzaak/open-notificaties',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        command: ['/celery_worker.sh'],
      }),
    );

    this.registerZgwService(
      'open-notificaties-celery-beat',
      new ZgwService(this, 'open-notificaties-celery-beat', {
        containerImage: 'openzaak/open-notificaties',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        command: ['/celery_beat.sh'],
      }),
    );

  }

  getEnvironmentConfiguration() {
    const environment = {
      DJANGO_SETTINGS_MODULE: 'nrc.conf.docker',
      DB_NAME: 'opennotificaties',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      IS_HTTPS: 'yes',
      ALLOWED_HOSTS: '*', // this.props.zgwCluster.alb.getDomain(),
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
      UWSGI_PORT: OpenNotificatiesService.PORT.toString(),
      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'True',
      DEBUG: 'True',

      // Open notificaties specific stuff
      OPENNOTIFICATIES_ORGANIZATION: 'ON',
      OPENNOTIFICATIES_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      NOTIF_OPENZAAK_CLIENT_ID: 'notificaties-client',
      NOTIF_OPENZAAK_SECRET: 'notificaties-secret',
      AUTORISATIES_API_ROOT: 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/autorisaties/api/v1',
      OPENZAAK_NOTIF_CLIENT_ID: 'oz-client',
      OPENZAAK_NOTIF_SECRET: 'oz-secret',

      // Setup demo user
      DEMO_CONFIG_ENABLE: 'yes',
      DEMO_CLIENT_ID: 'demo-client-id',
      DEMO_SECRET: 'demo-secret',
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