import * as fs from 'fs';

export async function handler(_event: any) {

  dir('/mnt/efs/');
  dir('/mnt/efs/app');
  dir('/mnt/efs/app/private-media/uploads/2024/07');
  dir('/mnt/efs/uploads/2024/07');
}


function dir(path: string) {
  const root = fs.readdirSync(path);
  console.log(path, JSON.stringify(root));
}