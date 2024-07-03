
import { App } from 'aws-cdk-lib';
import { ContainerClusterStack } from './ContainerClusterStack';
import { DatabaseStack } from './DatabaseStack';
import { ParameterStack } from './ParameterStack';
import { Statics } from './Statics';

const app = new App();

const params = new ParameterStack(app, 'zgw-demo-params', {
  env: Statics.sandboxMarnix,
  description: 'ZGW Eco systeem demo parameters',
});

const db = new DatabaseStack(app, 'zgw-demo-db', {
  env: Statics.sandboxMarnix,
  description: 'ZGW Eco systeem demo database',
});
db.addDependency(params);

const cluster = new ContainerClusterStack(app, 'zgw-demo', {
  env: Statics.sandboxMarnix,
  description: 'ZGW Eco systeem demo',
});

cluster.addDependency(db);
cluster.addDependency(params);


app.synth();