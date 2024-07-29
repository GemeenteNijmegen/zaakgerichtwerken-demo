import { GemeenteNijmegenCdkApp } from '@gemeentenijmegen/projen-project-type';
const project = new GemeenteNijmegenCdkApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  devDeps: ['@gemeentenijmegen/projen-project-type', '@gemeentenijmegen/aws-constructs', '@types/pg', 'dotenv'],
  deps: ['@gemeentenijmegen/aws-constructs', 'pg', '@aws/pdk', 'jsonwebtoken', '@types/jsonwebtoken'],
  name: 'zaakgerichtwerken',
  projenrcTs: true,
});
project.synth();