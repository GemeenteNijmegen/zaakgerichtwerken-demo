
import { CdkGraph } from '@aws/pdk/cdk-graph';
import { CdkGraphDiagramPlugin } from '@aws/pdk/cdk-graph-plugin-diagram';
import { App } from 'aws-cdk-lib';
import { getEnvironmentConfiguration } from './Configuration';
import { PipelineStack } from './PipelineStack';
import { Statics } from './Statics';


const branchToBuild = process.env.BRANCH_NAME ?? 'marnix';
const configuration = getEnvironmentConfiguration(branchToBuild);


const app = new App();

new PipelineStack(app, `${Statics.projectName}-pipeline-${branchToBuild}`, {
  configuration: configuration,
  env: configuration.buildEnvironment,
});

const graph = new CdkGraph(app, {
  plugins: [new CdkGraphDiagramPlugin()],
});

app.synth();


graph.report().then(() => console.log('done')).catch(err => console.error(err));
