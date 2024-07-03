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

}