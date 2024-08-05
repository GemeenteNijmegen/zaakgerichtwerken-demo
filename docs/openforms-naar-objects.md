# Open Forms naar objects + documenten

In Open Forms met legacy-koppeling geconfigureerd. De route is als volgt:

```mermaid
sequenceDiagram
participant OF as Open Forms
participant DRC as Document RC
participant ORC as Object RC
note over OF, ORC: legacy Objectstorage vanuit Open Forms
    OF ->> DRC: sla bijlage + inzending op
    DRC ->> OF: Geef URL bijlage terug
    OF ->> ORC: Sla inzending inclusief PDF en bijlage URL op
```
De nieuwe koppeling lijkt veel meer handwerk te zijn. Vraag: Is de legacy objects API-koppeling in open forms echt legacy. De nieuwe variant lijkt heel veel handwerk per formulier (nieuw objecttype, alle variabelen met de hand koppelen) op te leveren. Kan dat handiger?

## In de interface
In Open Forms bij het formulier:
![](img/formulierregistratie.png)
![](img/formulierregistratie-1.png)
![](img/formulierregistratie-2.png)
