export class Statics {

  static readonly projectName = 'zaakgerichtwerken';

  static readonly databaseName = 'zgwdatabase';

  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';

  static readonly ssmDbSecretArn = `/${this.projectName}/db/secret/arn`;
  static readonly ssmDbCredentialsArn = `/${this.projectName}/db/credentials/arn`;
  static readonly ssmDbArn = `/${this.projectName}/db/arn`;
  static readonly ssmDbHostname = `/${this.projectName}/db/hostname`;
  static readonly ssmDbPort = `/${this.projectName}/db/port`;
  static readonly ssmDbSecurityGroupId = `/${this.projectName}/db/securitygroupid`;

  static readonly sandboxMarnix = {
    account: '049753832279',
    region: 'eu-central-1',
  };

  /**
 * Redis instance subpaths. Have to be numbers between 0-15
 * Celery config requires redis:// before url, cache config does not
 */

  static readonly redisCeleryPathZaak = '/1';

  static readonly redisCachePathObjects = '/0';
  static readonly redisCeleryPathObjects = '/10';

  static readonly redisCachePathObjectsTypes = '/3';

  static readonly redisCachePathKlant = '/4';
  static readonly redisCeleryPathKlant = '/5';

  //static readonly redisCachePathNotifications = '/geen-subpath';
  static readonly redisCeleryPathNotifications = '/2';

}