
import { App } from 'aws-cdk-lib';
import { ContainerClusterStack } from './ContainerClusterStack';
import { ParameterStack } from './ParameterStack';
import { Statics } from './Statics';

const app = new App();

const params = new ParameterStack(app, 'zgw-demo-params', {
  env: Statics.sandboxMarnix,
  description: 'ZGW Eco systeem demo parameters',
});

const cluster = new ContainerClusterStack(app, 'zgw-demo', {
  env: Statics.sandboxMarnix,
  description: 'ZGW Eco systeem demo',
});

cluster.addDependency(params);


app.synth();