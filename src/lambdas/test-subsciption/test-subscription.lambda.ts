import { APIGatewayProxyEvent } from 'aws-lambda';

export async function handler(event: APIGatewayProxyEvent) {
  console.log(JSON.stringify(event));
  if (event.headers.Authorization !== 'supergeheimekey') {
    return {
      statusCode: 403,
      body: 'Unauthorized',
    };
  }
  return {
    statusCode: 200,
    body: 'ok',
  };
}