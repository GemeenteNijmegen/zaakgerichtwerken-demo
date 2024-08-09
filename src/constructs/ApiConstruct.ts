

import { AccessLogFormat, LogGroupLogDestination, RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { VpcLink } from 'aws-cdk-lib/aws-apigatewayv2';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGatewayDomain } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

interface ApiConstructProps {
  hostedzone: HostedZone;
  vpc: IVpc;
}


/**
 * Currently not used as it did not play nicely with the loadbalancer.
 * Note another API construct is used for a separate API that has nothing
 * to do with the loadbalancer.
 */
export class ApiConstruct extends Construct {

  readonly api: RestApi;
  public vpcLink?: VpcLink;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);
    this.api = this.setupApiGateway(props);
    this.vpcLink = this.setupVpcLink(props);
  }

  setupApiGateway(props: ApiConstructProps) {

    const cert = new Certificate(this, 'api-cert', {
      domainName: props.hostedzone.zoneName,
      validation: CertificateValidation.fromDns(props.hostedzone),
    });

    const accessLogging = new LogGroup(this, 'api-logging', {
      retention: RetentionDays.ONE_WEEK, // Very short lived for debugging purposes
    });

    const api = new RestApi(this, 'gateway', {
      description: 'API gateway for yivi-brp issue server',
      domainName: {
        certificate: cert,
        domainName: props.hostedzone.zoneName,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
      deployOptions: {
        accessLogDestination: new LogGroupLogDestination(accessLogging),
        accessLogFormat: AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            userAgent: '$context.identity.userAgent',
            sourceIp: '$context.identity.sourceIp',
            requestTime: '$context.requestTime',
            requestTimeEpoch: '$context.requestTimeEpoch',
            httpMethod: '$context.httpMethod',
            path: '$context.path',
            status: '$context.status',
            protocol: '$context.protocol',
            responseLength: '$context.responseLength',
            domainName: '$context.domainName',
            errorMessage: '$context.error.message',
            errorType: '$context.error.responseType',
            stage: '$context.stage',
            integrationError: '$context.integration.error',
            integrationStatus: '$context.integration.integrationStatus',
            integrationLatency: '$context.integration.latency',
            integrationRequestId: '$context.integration.requestId',
            integrationErrorMessage: '$context.integrationErrorMessage',
          }),
        ),
      },
    });

    // Setup DNS records
    if (!api.domainName) {
      throw Error('No domain name configured, cannot create alas and A record');
    }
    const alias = new ApiGatewayDomain(api.domainName);
    new ARecord(this, 'api-a-record', {
      zone: props.hostedzone,
      target: RecordTarget.fromAlias(alias),
    });

    return api;
  }

  private setupVpcLink(props: ApiConstructProps) {
    this.vpcLink = new VpcLink(this, 'vpc-link', {
      vpc: props.vpc,
    });
    return this.vpcLink;
  }


}