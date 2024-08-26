
const OPENKLANT_API = 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-klant/klantinteracties/api/v1/';

type ApiResponse = {
  url: string;
  [key: string]: any;
};

async function apiRequest(endpoint: string, method: string, body?: object): Promise<ApiResponse> {
  console.log(method, OPENKLANT_API + endpoint);
  const token = process.env.OPENKLANT_TOKEN;
  const response = await fetch(OPENKLANT_API + endpoint, {
    method,
    body: body ? JSON.stringify(body) : undefined,
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

export async function maakPersoonAan() {
  const input = {
    // nummer: randomInt(0, 999999), // Uniek identificerend nummer dat tijdens communicatie tussen mensen kan worden gebruikt om de specifieke partij aan te duiden. Zie: https://vng-realisatie.github.io/klantinteracties/basisterminologie.html#partijgegevens-en-basisgegevens
    digitaleAdressen: [], // [ { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' } ],
    voorkeursDigitaalAdres: null, //{ uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' },
    rekeningnummers: [], // [ { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' }, ],
    voorkeursRekeningnummer: null, // { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' },
    soortPartij: 'persoon', //  Enum: "persoon" "organisatie" "contactpersoon" (contactpersoon is voor een organisatie)
    indicatieActief: true, //Geeft aan of de contactgegevens van de partij nog gebruikt morgen worden om contact op te nemen. Gegevens van niet-actieve partijen mogen hiervoor niet worden gebruikt.
    voorkeurstaal: 'dut',
    partijIdentificatie: { // Staat niet in de docs maar is wel nodig?
      contactnaam: {
        voorletters: 'H',
        voornaam: 'Hans',
        voorvoegselAchternaam: 'de',
        achternaam: 'Jong',
      },
      volledigeNaam: 'H. de Jong',
    },
    // correspondentieadres: { // Adres waarop de partij post van de gemeente wil ontvangen. Dit mag afwijken van voor de verstrekker eventueel in een basisregistratie bekende adressen.
    //   nummeraanduidingId: 'string',
    //   adresregel1: 'string',
    //   adresregel2: 'string',
    //   adresregel3: 'string',
    //   land: 'stri',
    // },
    // bezoekadres: undefined, // Adres waarop de partij door gemeente bezocht wil worden. Dit mag afwijken van voor de verstrekker eventueel in een basisregistratie bekende adressen.
  };
  const response = await apiRequest('partijen', 'POST', input);
  return response.uuid;
}


export async function maakPersoonIdentificatieAan(partij: string, bsn: string) {
  const input = {
    identificeerdePartij: {
      uuid: partij,
    },
    // anderePartijIdentificator: 'string', // Vrij tekstveld om de verwijzing naar een niet-voorgedefinieerd objecttype, soort objectID of Register vast te leggen.
    partijIdentificator: {
      codeObjecttype: 'INGESCHREVEN NATUURLIJK PERSOON', // Type van het object, bijvoorbeeld: 'INGESCHREVEN NATUURLIJK PERSOON'.
      codeSoortObjectId: 'Burgerservicenummer', // Naam van de eigenschap die het object identificeert, bijvoorbeeld: 'Burgerservicenummer'.
      objectId: bsn, // Waarde van de eigenschap die het object identificeert, bijvoorbeeld: '123456788'.
      codeRegister: 'BRP', // Binnen het landschap van registers unieke omschrijving van het register waarin het object is geregistreerd, bijvoorbeeld: 'BRP'.
    },
  };
  const response = await apiRequest('partij-identificatoren', 'POST', input);
  return response.id;

}


export async function maakOrganisatieIdentificatieAan(partij: string, kvk: string) {
  const input = {
    identificeerdePartij: {
      uuid: partij,
    },
    // anderePartijIdentificator: 'string', // Vrij tekstveld om de verwijzing naar een niet-voorgedefinieerd objecttype, soort objectID of Register vast te leggen.
    partijIdentificator: {
      codeObjecttype: 'INGESCHREVEN ORGANISATIE', // Type van het object, bijvoorbeeld: 'INGESCHREVEN NATUURLIJK PERSOON'.
      codeSoortObjectId: 'KVK-nummer', // Naam van de eigenschap die het object identificeert, bijvoorbeeld: 'Burgerservicenummer'.
      objectId: kvk, // Waarde van de eigenschap die het object identificeert, bijvoorbeeld: '123456788'.
      codeRegister: 'KVK', // Binnen het landschap van registers unieke omschrijving van het register waarin het object is geregistreerd, bijvoorbeeld: 'BRP'.
    },
  };
  const response = await apiRequest('partij-identificatoren', 'POST', input);
  return response.id;

}


export async function voorkeurEmailOpslaan(partij: string, email: string) {
  const input = {
    verstrektDoorBetrokkene: null,
    verstrektDoorPartij: { uuid: partij },
    adres: email, // Digitaal adres waarmee een persoon of organisatie bereikt kan worden.
    soortDigitaalAdres: 'email', // Typering van het digitale adres die aangeeft via welk(e) kanaal of kanalen met dit adres contact kan worden opgenomen.
    omschrijving: 'Email address', // Omschrijving van het digitaal adres.
  };
  const response = await apiRequest('digitaleadressen', 'POST', input);

  if (!response.uuid) {
    throw Error('No UUID found for digitaal adres');
  }

  // Update the partij with an voorkeursDigitaalAdres
  const apiPartij = await apiRequest(`partijen/${partij}`, 'GET');
  apiPartij.voorkeursDigitaalAdres = {
    uuid: response.uuid,
  };
  await apiRequest(`partijen/${partij}`, 'PUT', apiPartij);

  return response.id;

}


export async function maakOrganisatieAan() {
  const input = {
    digitaleAdressen: [], // [ { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' } ],
    voorkeursDigitaalAdres: null, //{ uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' },
    rekeningnummers: [], // [ { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' }, ],
    voorkeursRekeningnummer: null, // { uuid: '095be615-a8ad-4c33-8e9c-c7612fbf6c9f' },
    soortPartij: 'organisatie', //  Enum: "persoon" "organisatie" "contactpersoon" (contactpersoon is voor een partij)
    indicatieActief: true, //Geeft aan of de contactgegevens van de partij nog gebruikt morgen worden om contact op te nemen. Gegevens van niet-actieve partijen mogen hiervoor niet worden gebruikt.
    voorkeurstaal: 'dut',
    partijIdentificatie: { // Staat niet in de docs maar is wel nodig?
      naam: 'Test organisatie',
    },
    // correspondentieadres: { // Adres waarop de partij post van de gemeente wil ontvangen. Dit mag afwijken van voor de verstrekker eventueel in een basisregistratie bekende adressen.
    //   nummeraanduidingId: 'string',
    //   adresregel1: 'string',
    //   adresregel2: 'string',
    //   adresregel3: 'string',
    //   land: 'stri',
    // },
    // bezoekadres: undefined, // Adres waarop de partij door gemeente bezocht wil worden. Dit mag afwijken van voor de verstrekker eventueel in een basisregistratie bekende adressen.
  };
  const response = await apiRequest('partijen', 'POST', input);
  return response.uuid;
}