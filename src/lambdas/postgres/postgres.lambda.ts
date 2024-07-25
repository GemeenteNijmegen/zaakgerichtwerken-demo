import * as postgres from 'pg';

const DATABASES = [
  'opennotificaties',
  'objects',
  'objecttypes',
  'openklant',
];

export async function handler(_event: any) {

  const client = new postgres.Client ({
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT!),
    database: 'postgres',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connection established');
    for (const db of DATABASES) {
      console.log(`creating database ${db}...`);
      await client.query(`CREATE DATABASE ${db};`);
    }
    console.log('Done!');
  } catch (error) {
    console.error(error);
  }

}