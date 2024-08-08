import 'dotenv/config';
import { describeLocalScripts } from './describeLocalScripts';
import { createEnkelVoudigInformatieObject } from '../scripts/CreateDocument';
import { publihsObjecttype } from '../scripts/CreateObjecttypes';
import { addStatusToZaak, createZaak } from '../scripts/CreateZaak';
import { generateCatalogus } from '../scripts/GenerateCatalogus';


describeLocalScripts('local-scripts', () => {

  test('1run', async () => {
    await generateCatalogus(true);
  });

  test('2run', async () => {
    const zaak = await createZaak();
    await addStatusToZaak(zaak, 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/statustypen/2e0edc16-fb56-4b3d-a227-3874d01003f5');
  }, 60000);

  test('create document', async() => {
    await createEnkelVoudigInformatieObject('https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/informatieobjecttypen/43d43290-8ead-410f-a2d4-8048842bdcf6');
  });


  test('Run', async () => {
    await publihsObjecttype('./scripts/TaakObjecttype.json', 'task');
  });

  // test('run', async () => {
  //   const zaak = await createZaakFromForm();
  //   await addStatusToZaak(zaak, 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/statustypen/2e0edc16-fb56-4b3d-a227-3874d01003f5');
  // });

});

