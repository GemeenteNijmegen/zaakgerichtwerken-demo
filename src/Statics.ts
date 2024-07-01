export class Statics {

  static readonly accountRootHostedZonePath: string = '/gemeente-nijmegen/account/hostedzone/';
  static readonly accountRootHostedZoneId: string = '/gemeente-nijmegen/account/hostedzone/id';
  static readonly accountRootHostedZoneName: string = '/gemeente-nijmegen/account/hostedzone/name';


  static readonly ssmParamsPath: string = '/cdk/openforms/ssm/';


  static readonly secretDockerHub: string = '/cdk/openforms/secret/dockerhub';


  static readonly secretDockerhubCredentials: string = '/cdk/openforms/secret/dockerhubcredentials';
  static readonly secretDockerhubCredentialsArn: string = 'arn:aws:secretsmanager:eu-central-1:833119272131:secret:/cdk/openforms/secret/dockerhubcredentials-WlozyZ';

  static readonly secretEmailUsername: string = '/cdk/openforms/secret/emailsmtpusername';
  static readonly secretEmailUsernameArn: string = 'arn:aws:secretsmanager:eu-central-1:833119272131:secret:/cdk/openforms/secret/emailsmtpusername-3Ttp07';
  static readonly secretEmailPassword: string = '/cdk/openforms/secret/emailsmtppassword';
  static readonly secretEmailPasswordArn: string = 'arn:aws:secretsmanager:eu-central-1:833119272131:secret:/cdk/openforms/secret/emailsmtppassword-2qdPe2';


  static readonly openFormsEnv = {
    account: '833119272131',
    region: 'eu-central-1',
  };


  // static readonly cloudfrontAlbAccessToken = '40ee4109-ac3f-452f-9bab-bf7ff6ed221a';

}