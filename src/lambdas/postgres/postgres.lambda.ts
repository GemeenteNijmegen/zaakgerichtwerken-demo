import * as postgres from 'pg';

const DATABASES = [
  'opennotificaties',
  'objects',
  'objecttypes',
  'openklant',
];

export async function handler(_event: any) {

  /**
   * Connect to the default postgres db.
   * Note for this to work we need to set force_ssl to 0 in de postgres db config.
   * See https://stackoverflow.com/questions/76899023/rds-while-connection-error-no-pg-hba-conf-entry-for-host
   */
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