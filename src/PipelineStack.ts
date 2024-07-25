import { PermissionsBoundaryAspect } from '@gemeentenijmegen/aws-constructs';
import { Stack, StackProps, Tags, pipelines, CfnParameter, Aspects, Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Configurable } from './Configuration';
import { ContainerClusterStack } from './ContainerClusterStack';
import { DatabaseStack } from './DatabaseStack';
import { ParameterStack } from './ParameterStack';
import { Statics } from './Statics';

export interface PipelineStackProps extends StackProps, Configurable {}

/**
 * The pipeline runs in a build environment, and is responsible for deploying
 * Cloudformation stacks to the workload account. The pipeline will first build
 * and synth the project, then deploy (self-mutating if necessary).
 */
export class PipelineStack extends Stack {
  branchName: string;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);
    Tags.of(this).add('cdkManaged', 'yes');
    Tags.of(this).add('Project', Statics.projectName);
    Aspects.of(this).add(new PermissionsBoundaryAspect());
    this.branchName = props.configuration.branch;

    /** On first deploy, providing a connectionArn param to `cdk deploy` is required, so the
     * codestarconnection can be setup. This connection is responsible for further deploys
     * triggering from a commit to the specified branch on Github.
     */
    const connectionArn = new CfnParameter(this, 'connectionArn');
    const source = this.connectionSource(connectionArn);

    const pipeline = this.pipeline(source);

    pipeline.addStage(new ZgwDemoStage(this, 'zgw-demo', {
      env: props.configuration.deploymentEnvironment,
      configuration: props.configuration,
    }));

  }

  pipeline(source: pipelines.CodePipelineSource): pipelines.CodePipeline {
    const synthStep = new pipelines.ShellStep('Synth', {
      input: source,
      env: {
        BRANCH_NAME: this.branchName,
      },
      commands: [
        'yarn install --frozen-lockfile',
        'npx projen build',
        'npx projen synth',
      ],
    });

    const pipeline = new pipelines.CodePipeline(this, 'pipeline', {
      pipelineName: `${Statics.projectName}-pipeline-${this.branchName}`,
      crossAccountKeys: true,
      synth: synthStep,
    });

    return pipeline;
  }

  /**
   * We use a codestarconnection to trigger automatic deploys from Github
   *
   * The value for this ARN can be found in the CodePipeline service under [settings->connections](https://eu-central-1.console.aws.amazon.com/codesuite/settings/connections?region=eu-central-1)
   * Usually this will be in the build-account.
   *
   * @param connectionArn the ARN for the codestarconnection.
   * @returns
   */
  private connectionSource(connectionArn: CfnParameter): pipelines.CodePipelineSource {
    return pipelines.CodePipelineSource.connection('GemeenteNijmegen/zaakgerichtwerken-demo', this.branchName, {
      connectionArn: connectionArn.valueAsString,
    });
  }
}

interface ZgwDemoStageProps extends Configurable, StageProps {}

class ZgwDemoStage extends Stage {
  constructor(scope: Construct, id: string, props: ZgwDemoStageProps) {
    super(scope, id, props);

    const params = new ParameterStack(this, 'params-stack', {
      env: props.configuration.deploymentEnvironment,
      description: 'ZGW Eco systeem demo parameters',
    });

    const db = new DatabaseStack(this, 'db-stack', {
      env: props.configuration.deploymentEnvironment,
      description: 'ZGW Eco systeem demo database',
    });
    db.addDependency(params);

    const cluster = new ContainerClusterStack(this, 'stack', {
      env: props.configuration.deploymentEnvironment,
      description: 'ZGW Eco systeem demo',
    });

    cluster.addDependency(db);
    cluster.addDependency(params);

  }
}