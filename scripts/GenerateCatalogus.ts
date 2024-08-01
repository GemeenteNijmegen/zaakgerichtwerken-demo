import { jwtToken } from './ZgwToken';

const CATALOGI_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/';

const clientId = process.env.ZGW_CLIENT_ID!;
const clientSecret = process.env.ZGW_CLIENT_SECRET!;
if (!clientId || !clientSecret) {
  throw new Error('Client ID and Secret must be provided');
}

type ApiResponse = {
  url: string;
  [key: string]: any;
};

async function apiRequest(endpoint: string, method: string, body: object): Promise<ApiResponse> {
  const jwt = jwtToken(clientId, 'marnix-local', clientSecret);
  console.log('fetching ' + CATALOGI_API + endpoint);
  const response = await fetch(CATALOGI_API + endpoint, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Authorization': `Bearer ${jwt}`,
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

async function createNijmegenCatalogus(domein?: string): Promise<string> {
  const catalogusData = {
    domein: domein ?? 'NYMGN',
    rsin: process.env.RSIN_NIJMEGEN,
    contactpersoonBeheerNaam: 'Gemeente Nijmegen',
    naam: 'Gemeente Nijmegen ' + domein,
  };

  const catalogus = await apiRequest('catalogussen', 'POST', catalogusData);
  return catalogus.url;
}

async function createZaaktype(catalogus: string, name: string): Promise<string> {
  const zaaktypeData = {
    identificatie: name,
    omschrijving: name,
    vertrouwelijkheidaanduiding: 'geheim',
    doel: 'Testen met ZGW APIs',
    aanleiding: 'string',
    indicatieInternOfExtern: 'intern',
    handelingInitiator: 'string',
    onderwerp: 'string',
    handelingBehandelaar: 'string',
    doorlooptijd: 'P1Y',
    opschortingEnAanhoudingMogelijk: true,
    verlengingMogelijk: false,
    publicatieIndicatie: true,
    productenOfDiensten: [],
    referentieproces: {
      naam: 'string',
      link: 'http://example.com',
    },
    verantwoordelijke: 'string',
    beginGeldigheid: new Date().toISOString().substring(0, 10),
    versiedatum: new Date().toISOString().substring(0, 10),
    catalogus,
    besluittypen: [],
    gerelateerdeZaaktypen: [],
    selectielijstProcestype: 'https://selectielijst.openzaak.nl/api/v1/procestypen/6a439f39-927e-4306-a44a-080b0e09fb53',
  };

  const zaaktype = await apiRequest('zaaktypen', 'POST', zaaktypeData);
  return zaaktype.url;
}

async function createRoltype(zaaktype: string, naam: string): Promise<void> {
  const roltypeData = {
    zaaktype,
    omschrijving: naam,
    omschrijvingGeneriek: naam,
  };

  await apiRequest('roltypen', 'POST', roltypeData);
}

async function createStatustype(zaaktype: string, naam: string, volgnummer: number): Promise<void> {
  const statustypeData = {
    zaaktype,
    omschrijving: naam,
    volgnummer,
  };

  await apiRequest('statustypen', 'POST', statustypeData);
}

async function createResultaattype(zaaktype: string, naam: string): Promise<void> {
  const statustypeData = {
    zaaktype: zaaktype,
    omschrijving: naam,
    resultaattypeomschrijving: 'https://selectielijst.openzaak.nl/api/v1/resultaattypeomschrijvingen/f33dbd16-68ae-4820-acb5-5f437bca5edb',
    selectielijstklasse: 'https://selectielijst.openzaak.nl/api/v1/resultaten/dc4107e6-0222-4289-a8cb-8bb9e743ba17',
    archiefnominatie: 'blijvend_bewaren', // anders moet ik een ander veld vullen...
  };

  await apiRequest('resultaattypen', 'POST', statustypeData);
}


export async function generateCatalogus(publish?: boolean): Promise<void> {
  try {
    const catalogus = await createNijmegenCatalogus('EEN');
    console.log('Created catalogus: ', catalogus);

    const zaaktypeOpenForms = await createZaaktype(catalogus, 'openforms');
    const zaaktypeWebformulieren = await createZaaktype(catalogus, 'webformulieren');
    console.log('Created zaaktypen: ', zaaktypeOpenForms, zaaktypeWebformulieren);

    await createRoltype(zaaktypeOpenForms, 'behandelaar');
    await createRoltype(zaaktypeWebformulieren, 'behandelaar');

    await createStatustype(zaaktypeOpenForms, 'ToDo', 1);
    await createStatustype(zaaktypeOpenForms, 'InProgress', 2);
    await createStatustype(zaaktypeOpenForms, 'Done', 3);

    await createStatustype(zaaktypeWebformulieren, 'ToDo', 1);
    await createStatustype(zaaktypeWebformulieren, 'InProgress', 2);
    await createStatustype(zaaktypeWebformulieren, 'Done', 3);

    await createResultaattype(zaaktypeOpenForms, 'ResultaatOpenForms');
    await createResultaattype(zaaktypeWebformulieren, 'ResultaatWebformulieren');

    const informatieObjectType = await createInformatieObjectType(catalogus);
    await linkInformatieObjectTypeToZaakType(informatieObjectType.url, zaaktypeOpenForms, 1);
    await linkInformatieObjectTypeToZaakType(informatieObjectType.url, zaaktypeWebformulieren, 1);
    if (publish) {
      await publishResource(informatieObjectType.url);

      await publishResource(zaaktypeOpenForms);
      await publishResource(zaaktypeWebformulieren);
    }

  } catch (err) {
    console.error('Error generating catalogus:', err);
  }
}

export async function createInformatieObjectType(catalogus: string) {
  const informatieObjectType = {
    catalogus: catalogus,
    omschrijving: 'Document',
    vertrouwelijkheidaanduiding: 'zaakvertrouwelijk',
    beginGeldigheid: new Date().toISOString().substring(0, 'yyyy-mm-dd'.length),
    informatieobjectcategorie: 'bijlages', //geen idee wat hier moet staan
  };

  return apiRequest('informatieobjecttypen', 'POST', informatieObjectType);

}

export async function linkInformatieObjectTypeToZaakType(informatieobjecttype: string, zaaktype: string, volgnummer: number) {
  const link = {
    zaaktype,
    informatieobjecttype,
    volgnummer,
    richting: 'inkomend',
  };
  await apiRequest('zaaktype-informatieobjecttypen', 'POST', link);
}


export async function publishResource(resourceUrl: string): Promise<void> {
  const jwt = jwtToken(clientId, 'marnix-local', clientSecret);

  const response = await fetch(resourceUrl + '/publish', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });

  console.log(JSON.stringify(await response.json(), null, 4));

}
