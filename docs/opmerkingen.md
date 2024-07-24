# Opmerkingen en bevindingen


- Niet zelf een failed notificatie toevoegen (nu kan ik het scherm niet meer laden..., vermoedelijk omdat het component niet correct geconfigureerd is)




# Log van acties

- Starten met proberen een notificatie te triggeren om te zien of dit werkt met de notificaties API. Waar overigens nog niets in zit aan subscriptions.
- Alles hangt aan elkaar vast. Ik heb uiteindelijk een catalogus aan kunnen maken. Deze catalogus moet een RSIN nummer hebben (iets randoms op intenret gevonden...), waarom moet dit altijd vast zitten aan een catalogus. Is er een gedeelde catalogus voor Gemeente? Heeft de gemeente een RSIN nummer? Ik snap het niet. Er is een gebrek aan duidelijke documentatie over waar elke API voor gebruikt zou moeten worden en naar welke concepten dit vettaald zou moeten worden in de ogranisatie. (23 juli 15.00).
- Als je een catalogus hebt is het mogelijk een zaaktype aan te maken die bij de catalogus hoort. Waar referenties naar andere types binnen de catalogus verwacht worden volstaat het mee sturen van een lege lijst ook vaak. Bijvoorbeeld voor het veld `besluittypen`.
- In de logging is te zien dat er een notificatie verstuurd wordt naar de notificatie API met een response van 201 Created. Dat is dus goed. RabbitMQ logging laat niets zien. Notificatie API logging ook niet.


24 juli
- Zaaktype is aangemaakt maar nog niet gepubliceerd. Hiervoor moet eerst nog een roltype, resultaattype en statustype toegevoegd worden.
- Een roltype is wel altijd gekoppeld aan een zaaktype, hiervoor moet je dus eerst een zaaktype aanmaken (nog niet publiceren), omdat een roltype altijd bij een zaak hoort wordt dit roltype ook meteen aan de zaak gekoppeld.
- Een resultaattype bevat referenties naar de selectielijst (urls). Dit is een publieke API met goede documentatie. https://selectielijst.openzaak.nl/api/v1/schema/#operation/resultaat_list
- Een zaaktype moet een selectielijstprocesstype hebben dat overeenkomt met het processtype van de het selectielijst-resultaat in het resultaattype.