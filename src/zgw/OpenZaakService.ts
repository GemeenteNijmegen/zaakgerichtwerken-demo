import {
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ComposedZgwService, ComposedZgwServiceProps } from './ComposedZgwService';
import { ZgwService } from './ZgwService';
import { Statics } from '../Statics';

export interface OpenZaakServiceProps extends ComposedZgwServiceProps {}

export class OpenZaakService extends ComposedZgwService {

  private static readonly PORT = 8080;

  constructor(scope: Construct, id: string, props: OpenZaakServiceProps) {
    super(scope, id, props);


    this.registerZgwService(
      'open-zaak',
      new ZgwService(this, 'open-zaak', {
        containerImage: 'openzaak/open-zaak',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        expose: {
          path: 'open-zaak',
          port: OpenZaakService.PORT,
          priority: 22, // Note must be unique across all alb rules
        },
        initContainerCommand: ['python', 'src/manage.py', 'register_kanalen', '&&', '/setup_configuration.sh'],
      }),
    );

    this.registerZgwService(
      'open-zaak-celery',
      new ZgwService(this, 'open-zaak-celery', {
        containerImage: 'openzaak/open-zaak',
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
      DJANGO_SETTINGS_MODULE: 'openzaak.conf.docker',
      DB_NAME: Statics.databaseName,
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      IS_HTTPS: 'yes',
      ALLOWED_HOSTS: '*', // See loadbalancer target remark above this.props.zgwCluster.alb.getDomain(),
      CORS_ALLOW_ALL_ORIGINS: 'True',
      CSRF_TRUSTED_ORIGINS: `https://${this.props.zgwCluster.alb.getDomain()}/open-zaak`,
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort,
      SUBPATH: '/open-zaak',
      // IMPORT_DOCUMENTEN_BASE_DIR=${IMPORT_DOCUMENTEN_BASE_DIR:-/app/import-data}
      // IMPORT_DOCUMENTEN_BATCH_SIZE=${IMPORT_DOCUMENTEN_BATCH_SIZE:-500}
      OPENZAAK_SUPERUSER_USERNAME: 'admin',
      DJANGO_SUPERUSER_PASSWORD: 'admin',
      OPENZAAK_SUPERUSER_EMAIL: 'admin@localhost',
      CELERY_BROKER_URL: 'redis://'+ this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/1',
      CELERY_RESULT_BACKEND: 'redis://'+ this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + '/1',
      CELERY_LOGLEVEL: 'DEBUG',
      CELERY_WORKER_CONCURRENCY: '4',
      UWSGI_PORT: OpenZaakService.PORT.toString(),
      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'True',
      DEBUG: 'True',

      // Openzaak specific stuff
      OPENZAAK_DOMAIN: this.props.zgwCluster.alb.getDomain(),
      OPENZAAK_ORGANIZATION: 'OZ',

      // Dit heeft pas effect als we het initalizatie script draaien
      NOTIF_OPENZAAK_CLIENT_ID: 'notificaties-client',
      NOTIF_OPENZAAK_SECRET: 'notificaties-secret',
      NOTIF_API_ROOT: 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-notificaties/api/v1/',
      OPENZAAK_NOTIF_CLIENT_ID: 'oz-client',
      OPENZAAK_NOTIF_SECRET: 'oz-secret',

      // Setup demo gegevens
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