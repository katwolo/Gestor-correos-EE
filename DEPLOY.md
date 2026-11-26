# Desplegament del Gestor EE (web + backend)

Aquest projecte té dues meitats:

- **Backend**: `Code.gs` + `appsscript.json`, que s'han d'enganxar manualment a un projecte d'Apps Script. No es pot desplegar automàticament des d'aquí — són passos que has de fer tu a la interfície de Google.
- **Frontend**: la carpeta `docs/`, pensada per servir-se com a lloc estàtic amb GitHub Pages.

La web no té pantalla de login, però el servidor demana una **contrasenya** (`APP_PASSWORD`), que cada dispositiu desa la primera vegada. Vegeu la nota de seguretat al final d'aquest document abans de desplegar.

**Important**: el projecte fa servir **dos Google Sheets diferents**, cadascun amb la seva pròpia caixa d'enllaç a la web (es desen per separat al navegador). Totes dues caixes viuen dins d'un mateix diàleg de "Configuració", que s'obre amb la icona ⚙️ de la capçalera.

1. **Excel oficial** (secció Dashboard + Excel oficial): el teu full real de seguiment de l'alumnat (p. ex. "2n EAS A 24-25..."). Només es fa servir la **primera pestanya**, sigui quin sigui el seu nom — la resta de pestanyes (INSTRUCCIONS, EMPRESES, etc.) s'ignoren. La columna **AC** (29a) s'utilitza per anotar les **hores realitzades a cada conveni** (una xifra per fila), perquè el Dashboard les sumi cap a les 515h totals del quadern.
2. **Enviar correus**: el full amb els fulls "Enviament"/"Plantilles"/"Registre" per disparar correus amb plantilles.

El projecte d'Apps Script només s'ha de lligar a **un** dels dos Sheets (normalment el d'"Enviar correus", ja que és el que necessita el trigger diari); l'altre es referencia només pel seu `sheetId` des de la web, sense necessitat de cap script propi.

Segueix els passos en ordre. Els cursos següents només cal repetir el pas 8 (canviar d'Sheet).

## 1. Obre l'editor d'Apps Script

Al teu Google Sheet d'"Enviar correus": **Extensions → Apps Script**. Si el projecte ja tenia `Benvinguda.gs`, `Enviament.gs` o `Trigger.gs`, esborra'ls (el nou `Code.gs` els substitueix del tot).

## 2. Enganxa el codi

- Crea un fitxer de script anomenat `Code` i enganxa-hi tot el contingut de `Code.gs` d'aquest repositori.
- Obre **Configuració del projecte** (icona d'engranatge) → activa "Mostra el fitxer de manifest 'appsscript.json' a l'editor".
- Obre `appsscript.json` des de l'editor i substitueix el seu contingut pel de `appsscript.json` d'aquest repositori.
- Desa (Ctrl/Cmd+S).

## 3. Script Properties

A **Configuració del projecte → Propietats de l'script**, afegeix:

| Propietat | Valor |
|---|---|
| `ENVIAMENT_SHEET_ID` | **Important**: l'ID del full d'"Enviar correus" (la part de l'URL entre `/d/` i `/edit`) — ha de ser exactament el mateix full que tens enganxat a la web. Sense això, el trigger diari fa servir el full al qual estigui lligat el projecte, que podria no coincidir |
| `APP_PASSWORD` | **Obligatòria.** La contrasenya de la web (millor una frase llarga). Sense aquesta propietat l'API no respon a res. Vegeu "Nota sobre seguretat" |
| `ALLOWED_SHEET_IDS` | **Recomanada.** Els IDs dels Sheets que pot fer servir la web, separats per comes (normalment dos: l'Excel oficial i el d'"Enviar correus"). Qualsevol altre Sheet es rebutja |
| `TEACHER_NOTIFY_EMAIL` | (opcional) email on rebre l'avís si algun enviament de correu falla |
| `CONTACT_EMAIL` | (opcional) correu de contacte que surt als missatges de benvinguda i del tutorial del menú del Sheet |

## 4. Executa la configuració inicial

A l'editor, selecciona la funció `configurarFullEnviament` al desplegable de funcions i prem ▶ Executar. La primera vegada Google et demanarà autoritzar els permisos (Compte no verificat → **Configuració avançada → Ves a "Gestor EE" (no segur)** — és normal en un script personal no publicat). Comprova al Sheet que:

- Han aparegut les capçaleres i caselles de verificació a "Enviament" (columnes E, I, M).
- El full "Plantilles" té les capçaleres i 3 plantilles d'exemple a partir de la fila 5.
- El desplegable de "Plantilla" (F/J/N a "Enviament") funciona.
- L'assumpte de `Plantilles!B1` conté `{{anyAcademic}}`.

Aquest pas només afecta el Sheet d'"Enviar correus" — el teu Excel oficial de seguiment no es toca ni cal configurar-lo, l'app hi llegeix i escriu directament respectant la seva estructura pròpia.

## 5. Desplega com a aplicació web

A l'editor d'Apps Script: **Desplega → Nou desplegament**.

- Tipus: **Aplicació web**.
- Executar com: **Jo (el teu email)**.
- Qui hi té accés: **Qualsevol persona**.

Prem **Desplega** i autoritza si et torna a demanar. Copia la URL que acaba en `/exec` i enganxa-la a `docs/js/config.js` (`EXEC_URL`).

> Quan editis `Code.gs` més endavant, fes servir **Gestionar desplegaments → Edita → Versió nova** perquè la URL `/exec` no canviï.
>
> **Ordre important quan actualitzis a la versió amb contrasenya:** primer afegeix `APP_PASSWORD` (i `ALLOWED_SHEET_IDS`) a les Script Properties, després enganxa el nou `Code.gs` i publica la versió nova. Si publiques el codi abans de crear la propietat, la web deixarà de funcionar fins que la creïs.

## 6. Activa GitHub Pages

Al repositori de GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` (o la que toqui) / carpeta `/docs`**. Guarda. Al cap d'uns segons la web serà accessible a `https://el-teu-usuari.github.io/nom-del-repositori/`.

## 7. Checklist de proves manuals

1. Obre la URL de Pages → hauria d'aparèixer directament el Dashboard, sense cap pantalla de login.
2. A "Excel oficial", enganxa l'enllaç del teu Excel oficial de seguiment → han d'aparèixer les dades del dashboard (incloent el rètol "Amb exempció de pràctiques") i la graella (respecta la primera pestanya). A cada targeta d'alumne han de sortir dues barres: hores del quadern (515h, o menys si té exempció) i l'estat de l'"Acord (ref05) i pla activitats (ref06)" del conveni actual. Comprova també el cercador per nom al costat del títol "Alumnat" (es pot combinar amb el filtre d'una tile).
3. Edita una cel·la de prova a la graella (p. ex. una llista desplegable com "Acord (ref05) i pla activitats (ref06)", o un número a "Hores realitzades") → comprova que el canvi es reflecteix al Sheet real i que les barres del Dashboard es recalculen.
4. Canvia directament a Google Sheets (Dades → Validació de dades) la llista d'opcions d'una columna `select` (p. ex. afegeix una opció nova a "Acord") i torna a carregar "Excel oficial" → el desplegable de la graella ha de mostrar la llista nova sense tocar `Code.gs` ni redesplegar res.
5. Prova el botó "+ fila" d'una fila → ha d'aparèixer una fila nova buida just a sota al Sheet real (per afegir un segon conveni del mateix alumne, deixant el nom en blanc).
6. A "Enviar correus", enganxa l'enllaç del Sheet d'enviament (diferent de l'anterior) i segueix l'assistent: alumne/a → tutor/a (comprova que es pot editar i desar el nom/correu del tutor/a) → plantilles (marca'n més d'una, prova "✏️" per editar-ne una i comprova que es desa al Sheet) → adjunts → confirmar. Marca una plantilla sense data (s'ha d'enviar a l'instant) i una altra amb una data futura (ha d'aparèixer al full nou "Programats" amb estat "Pendent"). Comprova que `Registre` registra `Estat=OK` per la que s'envia ara, i que si coincideix amb un dels 3 blocs clàssics, la casella/data del Sheet s'actualitzen soles.
7. Prem "📅 Veure correus programats" (a sobre de l'assistent): ha d'aparèixer la llista de tot el full "Programats". Edita la data d'un pendent (✏️ → canvia la data → 💾 Desa) i comprova que es reflecteix al Sheet; elimina'n un altre (🗑️, amb confirmació) i comprova que desapareix la fila del Sheet. Els que ja s'han enviat o han fallat no haurien de mostrar botons d'editar/eliminar. Si n'hi ha algun pendent amb data d'avui o anterior que encara no s'hagi enviat, prem "▶ Processa els pendents ara" i comprova que s'envia i passa a "Enviat" (si no, el missatge de resultat n'explicarà el motiu).
8. Prova un enviament amb un adjunt de Drive invàlid barrejat amb un de vàlid → el correu ha d'arribar amb l'adjunt vàlid, no sense cap.
9. A **Activadors** (rellotge, barra lateral de l'editor d'Apps Script) comprova que `enviament` segueix programat cada dia a les 8:00 — és el mateix trigger que, cada dia, revisa el full "Programats" i envia el que ja toqui.
10. Mòbil: obre la URL de Pages al mòbil (o simula-ho amb les eines de desenvolupador) i navega per les 3 seccions.

## 8. Cada curs nou

Quan copiïs qualsevol dels dos Sheets per a un curs nou, no cal tornar a desplegar res:

1. Enganxa el nou enllaç a "Excel oficial" i/o "Enviar correus" (es desen per separat, només al navegador, per curs/dispositiu).
2. Si el Sheet nou és **completament en blanc** (sense capçaleres ni dades), la mateixa web ho detecta i mostra un avís amb el botó **"🆕 Preparar aquest full nou per a l'ús amb la web"**, tant a "Excel oficial" (escriu les 29 capçaleres de l'estructura a la fila 2, els desplegables natius de Sheets i una primera fila buida) com a "Enviar correus" (crea "Enviament"/"Plantilles"/"Registre", capçaleres i 3 plantilles d'exemple). No cal fer res manualment a l'editor d'Apps Script per a aquest pas — només funciona sobre un full realment buit, no toca res si ja hi ha dades.
3. Alternativament, per al Sheet d'"Enviar correus" també es pot executar la funció `configurarFullEnviament` un cop des de l'editor d'Apps Script (Extensions → Apps Script → selecciona la funció → ▶ Executar) — fa exactament el mateix que el botó de la web.

L'any acadèmic de l'assumpte (`{{anyAcademic}}`) es calcula sol; no cal tocar-lo mai més.

## Nota sobre seguretat

La web no té pantalla de login, però **l'API demana una contrasenya** (`APP_PASSWORD`) a cada petició. La primera vegada que s'obre la web en un dispositiu, apareix un diàleg per escriure-la; es desa en aquell navegador **sense caducitat** i ja no es torna a demanar, tret que la canviïs al servidor (aleshores el diàleg torna a sortir, una sola vegada, amb l'avís "contrasenya incorrecta").

Per què cal: la web app s'executa amb els permisos del compte que la desplega (`executeAs: USER_DEPLOYING`) i la URL `/exec` és pública (és a `docs/js/config.js`). Sense contrasenya, qualsevol que tingués aquesta URL podria fer servir l'API sobre **qualsevol** Sheet al qual el compte tingui accés, també un Sheet creat per ell mateix i compartit amb el compte, i així **enviar correus des del compte del centre** amb el text que volgués. La contrasenya tanca aquest camí.

Capes de protecció:

| Capa | Què evita |
|---|---|
| `APP_PASSWORD` (obligatòria) | Que ningú sense la contrasenya llegeixi, escrigui o enviï res. Si la propietat no existeix, l'API es nega a funcionar (`SERVER_NOT_CONFIGURED`) |
| `ALLOWED_SHEET_IDS` (recomanada) | Que, fins i tot amb la contrasenya, es pugui treballar sobre un Sheet que no sigui un dels teus |
| Espera d'1,5 s en cada contrasenya incorrecta | Que es puguin provar contrasenyes a cegues ràpidament |

Recomanacions:

- Fes servir una **frase llarga** (p. ex. quatre paraules a l'atzar), no una paraula curta.
- Si creus que la contrasenya s'ha filtrat, canvia `APP_PASSWORD` a les Script Properties: tots els dispositius la tornaran a demanar.
- El botó "Reiniciar la web" del diàleg de Configuració esborra la contrasenya desada en aquell navegador (útil en un ordinador compartit).
