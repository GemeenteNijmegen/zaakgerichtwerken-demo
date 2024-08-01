import 'dotenv/config';
<<<<<<< HEAD
import { createEnkelVoudigInformatieObject } from '../scripts/CreateDocument';
import { addStatusToZaak, createZaak } from '../scripts/CreateZaak';
import { generateCatalogus } from '../scripts/GenerateCatalogus';

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
=======
import { run } from '../scripts/CreateObjecttypes';

// xtest('run', async () => {
//   await generateCatalogus();
// });

// xtest('run2', async () => {
//   const zaak = await createZaak();
//   await addStatusToZaak(zaak, 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/statustypen/2e0edc16-fb56-4b3d-a227-3874d01003f5');
// });

test('Run', async () => {
  await run();
});
>>>>>>> d921b626ff2c9dd9c329105389b91be3eca44994
