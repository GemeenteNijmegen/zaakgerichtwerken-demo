import * as fs from 'fs';

export async function handler(_event: any) {

  const root = fs.readdirSync('/efs');
  console.log(JSON.stringify(root));

  const data = fs.readdirSync('/efs/data');
  console.log(JSON.stringify(data));

  const app = fs.readdirSync('/efs/app');
  console.log(JSON.stringify(app));

}