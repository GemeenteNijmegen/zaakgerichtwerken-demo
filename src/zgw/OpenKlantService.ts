import {
  aws_ecs as ecs,
} from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { ComposedZgwService, ComposedZgwServiceProps } from './ComposedZgwService';
import { ZgwService } from './ZgwService';
import { Statics } from '../Statics';

export interface OpenKlantServiceProps extends ComposedZgwServiceProps {}

export class OpenKlantService extends ComposedZgwService {

  private static readonly PORT = 8080;

  constructor(scope: Construct, id: string, props: OpenKlantServiceProps) {
    super(scope, id, props);


    this.registerZgwService(
      'open-klant',
      new ZgwService(this, 'open-klant', {
        containerImage: 'maykinmedia/open-klant',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        expose: {
          path: 'open-klant',
          port: OpenKlantService.PORT,
          priority: 24, // Note must be unique across all alb rules
        },
        // Note: DB should be created before this command can run
        // Note2: can only be run once, a second time will fail and prevent the container from starting
        // initContainerCommand: ['python', 'src/manage.py', 'createsuperuser', '--no-input', '--username', 'mdessing', '--email', 'm.dessing@nijmegen.nl', '--skip-checks'],
      }),
    );

    this.registerZgwService(
      'open-klant-celery',
      new ZgwService(this, 'open-klant-celery', {
        containerImage: 'maykinmedia/open-klant',
        databaseCredentials: this.databaseCredentials,
        environment: this.getEnvironmentConfiguration(),
        secrets: this.getSecretConfiguration(),
        zgwCluster: props.zgwCluster,
        command: ['/celery_worker.sh'],
        desiredtaskcount: 1,
      }),
    );

  }

  getEnvironmentConfiguration() {
    const environment = {
      DJANGO_SETTINGS_MODULE: 'openklant.conf.docker',
      DB_NAME: 'openklant',
      DB_HOST: StringParameter.valueForStringParameter(this, Statics.ssmDbHostname),
      DB_PORT: StringParameter.valueForStringParameter(this, Statics.ssmDbPort),
      ALLOWED_HOSTS: '*', // See loadbalancer target remark above this.props.zgwCluster.alb.getDomain(),
      CACHE_DEFAULT: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + Statics.redisCachePathKlant,
      CACHE_AXES: this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + + Statics.redisCachePathKlant,
      SUBPATH: '/open-klant',
      IS_HTTPS: 'True',
      UWSGI_PORT: OpenKlantService.PORT.toString(),

      LOG_LEVEL: 'DEBUG',
      LOG_REQUESTS: 'True',
      LOG_QUERIES: 'False',
      DEBUG: 'True',

      // Celery
      CELERY_BROKER_URL: 'redis://'+this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + Statics.redisCeleryPathKlant,
      CELERY_RESULT_BACKEND: 'redis://'+this.props.zgwCluster.redis.redisCluster.attrRedisEndpointAddress + ':' + this.props.zgwCluster.redis.redisCluster.attrRedisEndpointPort + Statics.redisCeleryPathKlant,
      CELERY_LOGLEVEL: 'DEBUG',

      // Generic super user creation?
      DJANGO_SUPERUSER_USERNAME: 'admin',
      DJANGO_SUPERUSER_EMAIL: 'admin@example.com',
      DJANGO_SUPERUSER_PASSWORD: 'admin',

      // EMAIL configuration
      EMAIL_PORT: '465', // Or 2465
      EMAIL_HOST: 'email.eu-central-1.amazonaws.com',
      EMAIL_USE_TLS: 'True',
      DEFAULT_FROM_EMAIL: 'test@sandbox-marnix.csp-nijmegen.nl',
    };
    return environment;
  }

  getSecretConfiguration() {
    const secrets = {
      DB_PASSWORD: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password'),
      DB_USER: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username'),
      EMAIL_HOST_USER: ecs.Secret.fromSecretsManager(this.smtpCredentials, 'username'),
      EMAIL_HOST_PASSWORD: ecs.Secret.fromSecretsManager(this.smtpCredentials, 'password'),
    };
    return secrets;
  }

}