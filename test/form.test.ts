import 'dotenv/config';
import { addStatusToZaak, createZaakFromForm } from '../scripts/CreateZaakFromForm';

xtest('run', async () => {
  const zaak = await createZaakFromForm();
  await addStatusToZaak(zaak, 'https://lb.zgw.sandbox-marnix.csp-nijmegen.nl/open-zaak/catalogi/api/v1/statustypen/2e0edc16-fb56-4b3d-a227-3874d01003f5');

});