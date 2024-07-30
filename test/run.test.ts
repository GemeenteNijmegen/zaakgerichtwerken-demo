import 'dotenv/config';
import { addStatusToZaak, createZaak } from '../scripts/CreateZaak';
import { generateCatalogus } from '../scripts/GenerateCatalogus';

xtest('run', async () => {
  await generateCatalogus();
});

xtest('run2', async () => {
  const zaak = await createZaak();
  await addStatusToZaak(zaak, 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/statustypen/2e0edc16-fb56-4b3d-a227-3874d01003f5');
});