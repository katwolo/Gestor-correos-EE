# Gestor EE — funcionament pràctic

Aquesta web substitueix l'ús directe dels Google Sheets per gestionar les Estades d'Empresa (EE) de l'alumnat: un **Dashboard** per veure d'un cop d'ull en quin punt està cadascú, una graella (**Excel oficial**) per editar les dades sense obrir el Sheet, i un assistent (**Enviar correus**) per disparar els correus de seguiment amb plantilles.

No hi ha cap base de dades pròpia: **els Google Sheets són la font de veritat**. La web només hi llegeix i hi escriu via l'API d'Apps Script (`Code.gs`).

> Per als passos de desplegament (Apps Script, Script Properties, GitHub Pages), consulta `DEPLOY.md`. Aquest document explica només **com funciona la web un cop desplegada**.

## Els dos Google Sheets

El projecte fa servir **dos Sheets independents**, cadascun amb la seva pròpia caixa d'enllaç (es desen per separat al navegador, en `localStorage`). Totes dues caixes es troben juntes al diàleg **"Configuració dels Sheets"**, que s'obre amb la icona ⚙️ de la capçalera (al costat de "Tanca sessió"):

| Secció web | Sheet que fa servir | Què hi llegeix/escriu |
|---|---|---|
| Dashboard + Excel oficial | **Excel oficial** (el teu full real de seguiment, p. ex. "2n EAS A 24-25...") | Sempre la **primera pestanya**, sigui quin sigui el seu nom. La resta de pestanyes (INSTRUCCIONS, EMPRESES...) s'ignoren completament. |
| Enviar correus | **Enviament / Plantilles / Registre / Programats** | Els 4 fulls d'aquest segon Sheet (el darrer es crea sol la primera vegada que cal). |

Els dos enllaços són independents: pots tenir obert l'Excel oficial d'un grup i el Sheet de correus d'un altre sense que interfereixin.

---

## 1. Dashboard

Llegeix `getDashboard`, que processa la primera pestanya de l'Excel oficial fila a fila.

### Com s'agrupen les files en "alumnes"

A la fulla, les capçaleres són a la **fila 2** i les dades comencen a la **fila 3**. Un alumne pot ocupar **diverses files consecutives**, una per cada conveni/acord d'empresa que ha tingut. `agruparAlumnesRoster_` construeix un grup per alumne recorrent les files de dalt a baix:

- Si una fila té nom (columna A), **comença un grup nou** — o, si ja existia un grup amb exactament el mateix nom (en minúscules), **hi continua** (per si s'ha repetit el nom en lloc de deixar-lo en blanc).
- Si una fila **no té nom però té algun altre contingut**, es considera una **continuació** del grup obert just abans (un segon, tercer... conveni del mateix alumne).
- Una fila completament buida **tanca** el grup obert.

Per a cada grup es guarda:
- **`estat`**: sempre la **fila més avall** (l'última introduïda) — és la que es fa servir per a tot l'estat "actual" de l'alumne (pràctiques en curs, empresa, acord, quadern, nota final, fase del conveni...).
- **`totalHores`**: la **suma** de la columna "Hores realitzades" (columna **AC**, 29a) de **totes** les files del grup.
- **`exempcio`**: l'últim valor no buit trobat a "Exempció (%)" entre totes les files del grup.

En altres paraules: l'**estat/fase mostrats** corresponen sempre al **conveni més recent**, però les **hores del quadern es sumen entre tots els convenis** que hagi tingut l'alumne.

### Tiles (targetes de resum)

| Tile | Condició |
|---|---|
| **Actius** | `!finalitzat && practiques === 'SI'` |
| **Finalitzats** | La columna "Nota final" té algun valor |
| **Pendents de documentació** | Actiu i (l'acord no és "Enviat alumne/empresa" **o** el quadern (R22) no és "Enviat definitiu") |
| **Amb exempció de pràctiques** | El camp "Exempció (%)" té algun valor diferent de "No aplica" |
| **Total alumnat** | Nombre de grups (alumnes) |

Totes les tiles excepte "Total alumnat" són **clicables**: filtren la llista de targetes de sota (tornar a clicar-hi treu el filtre).

### Les dues barres de progrés de cada alumne

Cada targeta d'alumne mostra dues barres, una sota l'altra:

**1) Barra "Quadern"** — quantes hores porta fetes del quadern de pràctiques total.

- L'objectiu de base són **515 hores**.
- Si té una exempció concedida amb percentatge (**25%, 50% o 100%**), l'objectiu es redueix: `objectiu = 515 × (1 − percentatge/100)`. Amb 100% l'alumne apareix directament com "exempt/a" (barra plena).
- Valors com "Sol·licitud enviada" o "Negativa" a "Exempció (%)" **no** redueixen l'objectiu (es tracten com a 0%) fins que hi hagi un percentatge concret confirmat.
- Les **hores fetes** són la suma calculada abans (`totalHores`, sumant la columna AC de tots els convenis de l'alumne).
- La barra mostra "fetes / objectiu" i, si en falten, "falten Xh"; en arribar al 100% es marca com a completa (color diferent).

**2) Barra "Acord (ref05/06)"** — en quin punt està el tràmit d'acord i pla d'activitats del conveni **més recent** (l'última fila del grup), segons la columna "Acord (ref05) i pla activitats (ref06)":

```
(Pendent)  →  Falta  →  Entregat  →  Rebut de coord FCT  →  Enviat alumne/empresa
```

La barra omple `(índex_fase + 1) / 5`. Una cel·la buida es tracta com "(Pendent)" (fase 0); un valor no reconegut fa el mateix. **Important**: aquesta fase és sempre la del **conveni més recent**, no un resum de tots els convenis — si un alumne ja ha tancat un primer conveni i n'ha començat un segon, la barra reflecteix el segon.

### Cercador d'alumnes

Al costat del títol "Alumnat" hi ha un camp de cerca per nom. Filtra en temps real la llista de targetes de sota i es pot combinar amb el filtre d'una tile (p. ex. "Actius" + escriure un nom per trobar-lo ràpid dins d'aquell subconjunt).

---

## 2. Excel oficial

Graella editable directament sobre la primera pestanya de l'Excel oficial (`getSheetData` / `updateCell` / `insertRow`), sense passar per la interfície de Google Sheets:

- **Capçalera i primera columna fixes** (`position: sticky`) perquè es pugui fer scroll per les 29 columnes sense perdre de vista de quin alumne/columna es tracta.
- Cada columna es renderitza segons el seu **tipus**, definit al backend (`ROSTER_COLUMNS`): `select` (desplegable amb les mateixes opcions que el Sheet), `data` (input de data) o `text` (cel·la editable en línia). Els canvis es desen a l'instant (`updateCell`) en editar/desseleccionar la cel·la, amb un flaix verd/vermell de confirmació.
- Cada fila té un botó **"+"** a la primera columna: insereix una fila buida just a sota (mateix mecanisme que "Insereix fila" de Sheets, que copia format i validacions). Serveix per afegir un **nou conveni** a un alumne existent: es deixa el nom en blanc perquè `agruparAlumnesRoster_` l'agrupi automàticament amb les files anteriors del mateix alumne.

No hi ha cap "configuració" que calgui executar sobre aquest Sheet: l'app hi llegeix/escriu directament respectant la seva pròpia estructura de 29 columnes.

### Començar des d'un Google Sheets nou i buit

Si enganxes l'enllaç d'un Google Sheets completament nou (sense capçaleres ni dades), en lloc de la graella apareix un avís amb el botó **"🆕 Preparar aquest full nou per a l'ús amb la web"** (`configurarFullOficial`). En prémer'l:

- Escriu les 29 capçaleres de `ROSTER_COLUMNS` a la fila 2.
- Aplica els desplegables natius de Google Sheets a les columnes de tipus `select` (per si mai obres el full directament — la web sempre fa servir el seu propi desplegable i no en depèn).
- Afegeix una primera fila buida (fila 3) perquè ja hi hagi on prémer "+" i començar a introduir alumnat.

És idempotent i **no toca res si el full ja té capçaleres o dades**: només pensat per arrencar un full en blanc, mai per "reparar" un full real ja en ús.

---

## 3. Enviar correus

Aquesta secció és un **assistent (wizard) de 5 passos** sobre el segon Sheet ("Enviament" / "Plantilles" / "Registre" / "Programats"). Cada pas queda marcat com actiu/fet a la barra superior i es pot tornar enrere en qualsevol moment.

### Pas 1 — Alumne/a

Llista (amb cercador) de totes les files del full **"Enviament"** que tenen nom a la columna A (`getStudents`). En triar-ne un, es passa al pas següent.

### Pas 2 — Tutor/a

Mostra el nom i el correu del tutor/a d'empresa d'aquest alumne (columnes C/D d'"Enviament") i permet editar-los i desar-los (`updateAlumneTutor`) sense haver d'obrir el Sheet. Cal desar-ho abans de continuar si s'ha canviat res, ja que els placeholders del correu es generen amb aquestes dades.

### Pas 3 — Plantilles

Llista totes les plantilles definides al full **"Plantilles"** (`getPlantilles`, llegides a partir de la fila 5). Es poden **marcar diverses alhora**; per a cada una marcada apareix un selector de data ("Quan?" — buit = enviar-la ara mateix).

Cada plantilla mostra una etiqueta de **destinatari** (columna C de "Plantilles"): **Tutor/a**, **Alumnat** o **Ambdós** — determina a qui s'envia el correu (veure més avall).

El botó **✏️** obre un editor inline per a aquesta plantilla concreta (cos del correu editable i selector de destinatari); en desar (`updatePlantilla`) el canvi s'escriu directament al full "Plantilles" i afecta **tots** els futurs enviaments d'aquesta plantilla (no és un ajust puntual només per aquest alumne).

### Pas 4 — Adjunts

Un camp de text amb enllaços de Google Drive separats per comes, opcional. S'adjuntaran a **totes** les plantilles seleccionades en aquest enviament. Si algun enllaç no és vàlid, el correu s'envia igualment amb els adjunts que sí que s'han pogut resoldre (no es perden tots per un de trencat).

### Pas 5 — Confirmar

Es genera una previsualització (`previewCorreu` per a cada plantilla marcada) mostrant els destinataris finals resolts (correus reals) per a cadascuna, i si s'enviarà **ara mateix** o en la data programada. En confirmar (`programarEnviaments`):

- Les plantilles **sense data o amb data d'avui/passada** s'envien **a l'instant**.
- Les plantilles amb **data futura** es desen com una fila nova al full **"Programats"** amb estat "Pendent" (no es crea cap trigger individual — Apps Script només permet 20 triggers per projecte, així que totes les tasques programades comparteixen el mateix trigger diari).

### Com es resol el destinatari

Segons el camp "destinatari" de la plantilla (`resoldreDestinataris_`):

| Destinatari | Correus als quals s'envia |
|---|---|
| **Tutor/a** (per defecte) | Correu del tutor/a d'empresa (columna D) |
| **Alumnat** | Correu de l'alumne/a (columna B) |
| **Ambdós** | Els dos correus anteriors (dos enviaments separats) |

Si el correu necessari és buit, aquell destinatari es descarta sense error (però si **cap** dels dos té correu, l'enviament es registra com a error).

### Placeholders disponibles

Es poden fer servir tant a l'assumpte (definit a `Plantilles!B1`, comú a totes) com al cos de cada plantilla:

| Placeholder | Es substitueix per |
|---|---|
| `{{nombreAlumno}}` | Nom + cognoms de l'alumne/a (columnes A + Q d'"Enviament") |
| `{{correoAlumno}}` | Correu de l'alumne/a (columna B) |
| `{{nombreTutor}}` | Nom del tutor/a d'empresa (columna C) |
| `{{correoTutor}}` | Correu del tutor/a d'empresa (columna D) |
| `{{anyAcademic}}` | Any acadèmic actual, calculat sol (p. ex. "25-26"), amb tall a l'1 de setembre — mai cal tocar-lo a mà |

### El trigger diari i la cua "Programats"

Cada dia a les **8:00** s'executa automàticament la funció `enviament` (el mateix trigger que ja existia abans d'aquesta web — es conserva el nom de funció perquè el trigger instal·lat no es trenqui en actualitzar el codi). En cada execució:

1. Recorre el full "Enviament" buscant els **3 blocs clàssics** (Contacte inicial / Seguiment / Valoració final, columnes E-H / I-L / M-P): si la casella està marcada, hi ha plantilla indicada i la data (si n'hi ha) ja ha passat, envia el correu.
2. Recorre el full **"Programats"** buscant files amb estat "Pendent" la data de les quals ja ha arribat, i les envia amb el mateix mecanisme.
3. Si hi ha hagut algun problema (plantilla no trobada, adjunt invàlid, error d'enviament...), s'envia un **únic correu-resum** d'incidències a `TEACHER_NOTIFY_EMAIL` (o al propi compte si no s'ha configurat cap), en lloc d'un correu per cada error.

Aquest mateix mecanisme de trigger diari és el que processa, l'endemà o quan toqui, els enviaments que s'han programat amb data futura des del pas 5 de l'assistent.

**Important**: el trigger diari sap sobre quin Sheet ha de treballar a partir de l'Script Property **`ENVIAMENT_SHEET_ID`** (vegeu `DEPLOY.md`) — ha de contenir exactament el mateix `sheetId` que tens enganxat a la web d'"Enviar correus". Si aquesta propietat no està configurada, el trigger cau en el comportament antic (`SpreadsheetApp.getActiveSpreadsheet()`, és a dir, el Sheet al qual estigui físicament lligat el projecte d'Apps Script), que pot no coincidir amb el que fas servir a la web — en aquest cas el trigger s'executa "Completada" sense cap error a l'historial d'Execucions, però mirant un full equivocat, i els correus programats es queden "Pendents" per sempre en silenci. Configurar `ENVIAMENT_SHEET_ID` elimina aquesta ambigüitat.

### Veure, editar, cancel·lar o forçar l'enviament dels correus programats

A sobre de l'assistent hi ha el botó **"📅 Veure correus programats"**, que mostra tot el contingut del full "Programats" (`getProgramats`): alumne/a, plantilla, data prevista i estat (**Pendent** / **Enviat** / **Error: ...**).

- Els que encara estan **Pendents** es poden **editar** (✏️, per canviar la data prevista — `updateProgramat`) o **eliminar** (🗑️, amb confirmació — `deleteProgramat`, cancel·la l'enviament esborrant la fila del full).
- Els que ja s'han **enviat** o han donat **error** es mostren només de lectura (no té sentit reprogramar-los des d'aquí); per reintentar-ne un que ha fallat, torna a fer-lo des de l'assistent.
- Si hi ha algun pendent, apareix el botó **"▶ Processa els pendents ara"**: força el mateix processament que fa el trigger diari (blocs clàssics + cua "Programats"), però **directament sobre el sheetId enganxat al navegador**, sense dependre de si el trigger ja ha passat ni de a quin Sheet estigui lligat el projecte d'Apps Script. És la manera més ràpida de comprovar per què un correu "d'avui" encara no ha sortit: prem el botó i mira el missatge de resultat (si hi ha alguna incidència, es mostra allà mateix, en lloc de només al correu-resum de `TEACHER_NOTIFY_EMAIL`).

### Sincronització amb els 3 blocs clàssics

Si el nom d'una plantilla enviada (des de la web o pel trigger) coincideix —ignorant accents, majúscules i espais— amb "Contacte inicial", "Seguiment" o "Valoració final", en enviar-se correctament es **desmarca la casella i s'hi estampa la data** a les columnes clàssiques d'"Enviament" (E-P), exactament igual que si s'hagués marcat i disparat des del propi Sheet. Així la web i el flux antic (menú "Enviaments" del propi Sheet) es mantenen coherents encara que es facin servir barrejats.

### Registre

Cada intent d'enviament (èxit o error, un per destinatari) queda enregistrat al full **"Registre"**: data, hora, destinatari, assumpte, plantilla usada i estat ("OK" o "ERROR: ..."). És només de lectura des de la web (no hi ha cap acció per editar-lo); serveix d'historial per revisar qui ha rebut què i quan.

### Començar des d'un Google Sheets nou i buit

Igual que a "Excel oficial", si enganxes l'enllaç d'un Sheet completament nou i sense cap plantilla, apareix un avís amb el botó **"🆕 Preparar aquest full nou per a l'ús amb la web"** (reutilitza `configurarFullEnviament_`): crea els fulls "Enviament"/"Plantilles"/"Registre" si no existeixen, hi escriu les capçaleres i 3 plantilles d'exemple, i deixa l'assumpte base amb `{{anyAcademic}}`. També es pot llançar manualment des de l'editor d'Apps Script (funció `configurarFullEnviament`) — fa exactament el mateix.

---

## Autenticació

L'accés a tota la web es protegeix amb una **contrasenya compartida simple** (Script Property `APP_PASSWORD`), enviada a cada crida a l'API i verificada al backend — no hi ha login de Google ni compte per usuari. Es guarda només en memòria del navegador (es perd en tancar la pestanya). Vegeu la nota de seguretat a `DEPLOY.md`.
