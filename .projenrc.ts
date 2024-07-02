import { GemeenteNijmegenCdkApp } from '@gemeentenijmegen/projen-project-type';
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  devDeps: ['@gemeentenijmegen/projen-project-type', '@gemeentenijmegen/aws-constructs'],
  deps: ['@gemeentenijmegen/aws-constructs'],
  name: 'zaakgerichtwerken',
  projenrcTs: true,
});
project.synth();