import { aws_route53_targets } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { IVpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationListener, ApplicationLoadBalancer, ApplicationProtocol, ListenerAction, SslPolicy } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ARecord, IHostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface LoadbalancerConstructProps {
  vpc: IVpc;
  hostedzone: IHostedZone;
}


export class LoadBalancerConstruct extends Construct {

  readonly loadbalancer: ApplicationLoadBalancer;
  readonly listener: ApplicationListener;

  private readonly props: LoadbalancerConstructProps;

  constructor(scope: Construct, id: string, props: LoadbalancerConstructProps) {
    super(scope, id);

    this.props = props;

    this.loadbalancer = this.setupLoadbalancer(props);
    this.listener = this.setupListner(props);
    this.setupDnsRecords();

  }

  private setupDnsRecords() {
    new ARecord(this, 'a', {
      target: RecordTarget.fromAlias(new aws_route53_targets.LoadBalancerTarget(this.loadbalancer)),
      zone: this.props.hostedzone,
      recordName: 'lb',
    });
  }

  private setupLoadbalancer(props: LoadbalancerConstructProps) {
    return new ApplicationLoadBalancer(this, 'alb', {
      vpc: props.vpc,
      internetFacing: true,
    });
  }

  private setupListner(props: LoadbalancerConstructProps) {

    // Get a certificate
    const certificate = new Certificate(this, 'loadbalancer-certificate', {
      domainName: this.getDomain(),
      validation: CertificateValidation.fromDns(props.hostedzone),
    });

    // Setup a https listner
    const listener = this.loadbalancer.addListener('https', {
      certificates: [certificate],
      protocol: ApplicationProtocol.HTTPS,
      sslPolicy: SslPolicy.FORWARD_SECRECY_TLS12_RES,
      port: 443,
    });

    listener.addAction('default', {
      action: ListenerAction.fixedResponse(404, {
        contentType: 'application/json',
        messageBody: JSON.stringify({
          message: 'Woah, we didn\'t find what you were looking for',
        }),
      }),
    });

    return listener;
  }


  getDomain() {
    return `lb.${this.props.hostedzone.zoneName}`;
  }


}