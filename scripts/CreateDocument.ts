import { jwtToken } from './ZgwToken';

const DOCUMENTEN_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/documenten/api/v1/';
const jwt = jwtToken(process.env.ZGW_CLIENT_ID!, 'marnix-local', process.env.ZGW_CLIENT_SECRET!);

type ApiResponse = {
  url: string;
  [key: string]: any;
};

async function apiRequest(endpoint: string, method: string, body: object): Promise<ApiResponse> {
  console.log('fetching ' + DOCUMENTEN_API + endpoint);
  const response = await fetch(DOCUMENTEN_API + endpoint, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'Content-Crs': 'EPSG:4326',
      'Accept-Crs': 'EPSG:4326',
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

export async function createEnkelVoudigInformatieObject(informatieobjecttype: string) {
  const input = {
    bronorganisatie: process.env.RSIN_NIJMEGEN,
    creatiedatum: new Date().toISOString().substring(0, 'yyyy-mm-dd'.length),
    titel: 'my first document',
    auteur: 'devops Nijmegen',
    taal: 'dut',
    informatieobjecttype: informatieobjecttype,
    inhoud: 'dGVzdGluaG91ZAo=',
    formaat: 'text/plain',
    bestandsnaam: 'myfirstdocument.txt',
  };
  await apiRequest('enkelvoudiginformatieobjecten', 'POST', input);
}
