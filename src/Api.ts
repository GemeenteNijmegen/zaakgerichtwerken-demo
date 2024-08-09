import { ApiKey, LambdaIntegration, RestApi, SecurityPolicy } from 'aws-cdk-lib/aws-apigateway';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { ARecord, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { ApiGateway } from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { DnsConstruct } from './constructs/DnsConstruct';
import { TestSubscriptionFunction } from './lambdas/test-subsciption/test-subscription-function';

interface CallbackApiProps {
  subdomain: DnsConstruct;
};

export class CallbackApi extends Construct {
  private props: CallbackApiProps;

  constructor(scope: Construct, id: string, props: CallbackApiProps) {
    super(scope, id);
    this.props = props;

    const cert = this.cert();
    const api = this.api(cert);
    this.addDnsRecords(api);

    const resource = api.root.addResource('test-subscription');
    const testSubscriptionFunction = new TestSubscriptionFunction(this, 'test-subscription', {
      description: 'Test api notification subscriptions',
    });
    const lambdaIntegration = new LambdaIntegration(testSubscriptionFunction);
    resource.addMethod('GET', lambdaIntegration, { apiKeyRequired: true });

  }

  private addDnsRecords(api: RestApi) {
    new ARecord(this, 'a-record', {
      zone: this.props.subdomain.hostedzone,
      target: RecordTarget.fromAlias(new ApiGateway(api)),
    });
  }

  private api(cert: Certificate) {
    const api = new RestApi(this, 'api', {
      description: 'API Gateway for callbacks from zgw notifications-api',
      domainName: {
        certificate: cert,
        domainName: this.props.subdomain.hostedzone.zoneName,
        securityPolicy: SecurityPolicy.TLS_1_2,
      },
    });

    const plan = api.addUsagePlan('plan', {
      description: 'Used for callbacks to this api',
    });
    const key = new ApiKey(this, 'apikey', {
      description: 'Used for callbacks to this api',
    });
    plan.addApiKey(key);
    plan.node.addDependency(key);
    plan.addApiStage({
      stage: api.deploymentStage,
    });
    return api;
  }

  private cert() {
    const cert = new Certificate(this, 'api-cert', {
      domainName: this.props.subdomain.hostedzone.zoneName,
      validation: CertificateValidation.fromDns(this.props.subdomain.hostedzone),
    });
    return cert;
  }
}