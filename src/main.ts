
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContainerClusterStack } from './ContainerClusterStack';
import { ParameterStack } from './ParameterStack';
import { Statics } from './Statics';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {

    super(scope, id, props);


    // define resources here...
  }


}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'openforms-test-temp-dev', { env: devEnv });
// new MyStack(app, 'openforms-test-temp-prod', { env: prodEnv });

const parameterStack = new ParameterStack(app, 'parameter-stack', {
  env: Statics.openFormsEnv,
  description: 'Parameters and secrets for openFormsTest',
});
const cluster = new ContainerClusterStack(app, 'cluster-stack-rds-service', {
  env: Statics.openFormsEnv,
  description: 'ecs cluster and services for openforms test',
});
cluster.addDependency(parameterStack);

app.synth();