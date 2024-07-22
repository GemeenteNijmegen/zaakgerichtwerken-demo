
import { CdkGraph } from '@aws/pdk/cdk-graph';
import { CdkGraphDiagramPlugin } from '@aws/pdk/cdk-graph-plugin-diagram';
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

// Add CdkGraph after other construct added to app
const graph = new CdkGraph(app, {
  plugins: [new CdkGraphDiagramPlugin()],
});

app.synth();


graph.report().then(() => console.log('done')).catch(err => console.error(err));
