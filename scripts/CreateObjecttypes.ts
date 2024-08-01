import { readFileSync } from 'fs';

const OBJECTTYPES_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/objecttypes/api/v2/';
// const OBJECTS_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/objects/api/v2/';
// const RISN_NIJMEGEN = '001479179';

const token = '20c0b165731c08f55f9e680b708d11241378d8c3';

type ApiResponse = {
  url: string;
  [key: string]: any;
};

async function apiRequest(endpoint: string, method: string, body: object): Promise<ApiResponse> {
  const response = await fetch(endpoint, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(response);
  const json = await response.json() as ApiResponse;
  console.log(json);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}, message: ${json.detail || 'Unknown error'}`);
  }

  return json;
}

async function createObjecttype(name: string): Promise<string> {
  const input = {
    name: name,
    namePlural: name + 's',
    allowGeometry: false,
  };

  const response = await apiRequest(OBJECTTYPES_API + 'objecttypes', 'POST', input);
  return response.uuid;
}


async function createObjecttypeVersion(objecttypeUuid:string, schema: any): Promise<string> {

  const input = {
    status: 'published',
    jsonSchema: schema,
  };

  const response = await apiRequest(OBJECTTYPES_API + 'objecttypes/' + objecttypeUuid + '/versions', 'POST', input);
  return response.url;
}


export async function run() {
  const schema = readFileSync('./scripts/taakSchema.json', {
    encoding: 'utf-8',
  });
  const objecttype = await createObjecttype('submission');
  console.log(objecttype);
  await createObjecttypeVersion(objecttype, JSON.parse(schema));
}

