import { jwtToken } from './ZgwToken';

const ZAKEN_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/zaken/api/v1/';
const jwt = jwtToken(process.env.ZGW_CLIENT_ID!, 'marnix-local', process.env.ZGW_CLIENT_SECRET!);

export async function createZaak() {

  const response = await fetch(ZAKEN_API + 'zaken', {
    method: 'POST',
    body: JSON.stringify({
      bronorganisatie: '001479179',
      zaaktype: 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/zaaktypen/3b413bd5-6dc0-4a80-be60-648228d15ba6',
      verantwoordelijkeOrganisatie: '001479179',
      startdatum: '2019-08-24',
    }),
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-type': 'application/json',
      'Content-Crs': 'EPSG:4326',
      'Accept-Crs': 'EPSG:4326',
    },
  });
  console.log(response);
  const json = await response.json() as any;
  console.log(json);
  if (response.status < 200 || response.status > 300) {
    throw Error('Not a 2xx response');
  }
  return json.url;


}


export async function addStatusToZaak(zaak: string, status: string) {

  const response = await fetch(ZAKEN_API + 'statussen', {
    method: 'POST',
    body: JSON.stringify({
      zaak: zaak,
      statustype: status,
      datumStatusGezet: new Date().toISOString().substring(0, 10),
      statustoelichting: 'Zaak aangemaakt',
    }),
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-type': 'application/json',
      'Content-Crs': 'EPSG:4326',
      'Accept-Crs': 'EPSG:4326',
    },
  });
  console.log(response);
  const json = await response.json() as any;
  console.log(json);
  if (response.status < 200 || response.status > 300) {
    throw Error('Not a 2xx response');
  }
  return json.url;


}