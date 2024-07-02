export class Statics {

  static readonly projectName = 'zaakgerichtwerken';

  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';

  static readonly ssmDbSecretArn = `/${this.projectName}/db/secret/arn`;

  static readonly sandboxMarnix = {
    account: '049753832279',
    region: 'eu-central-1',
  };

}