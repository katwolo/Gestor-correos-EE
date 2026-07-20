# Desplegament del Gestor EE (web + backend)

Aquest projecte té dues meitats:

- **Backend**: `Code.gs` + `appsscript.json`, que s'han d'enganxar manualment a un projecte d'Apps Script lligat al teu Google Sheet oficial. No es pot desplegar automàticament des d'aquí — són passos que has de fer tu a la interfície de Google.
- **Frontend**: la carpeta `docs/`, pensada per servir-se com a lloc estàtic amb GitHub Pages.

Segueix els passos en ordre. Es triga uns 20-30 minuts la primera vegada; els cursos següents només cal repetir el pas 9 (canviar d'Sheet).

## 1. Obre l'editor d'Apps Script

Al teu Google Sheet oficial: **Extensions → Apps Script**. Si el projecte ja tenia `Benvinguda.gs`, `Enviament.gs` o `Trigger.gs`, esborra'ls (el nou `Code.gs` els substitueix del tot).

## 2. Enganxa el codi

- Crea un fitxer de script anomenat `Code` i enganxa-hi tot el contingut de `Code.gs` d'aquest repositori.
- Obre **Configuració del projecte** (icona d'engranatge) → activa "Mostra el fitxer de manifest 'appsscript.json' a l'editor".
- Obre `appsscript.json` des de l'editor i substitueix el seu contingut pel de `appsscript.json` d'aquest repositori.
- Desa (Ctrl/Cmd+S).

## 3. Script Properties

A **Configuració del projecte → Propietats de l'script**, afegeix:

| Propietat | Valor |
|---|---|
| `ALLOWED_EMAILS` | El(s) teu(s) email(s) de Google separats per comes (p. ex. `ibustos@ieb.cat`) |
| `GOOGLE_CLIENT_ID` | (el rebràs al pas 5 — torna aquí i afegeix-lo després) |
| `TEACHER_NOTIFY_EMAIL` | (opcional) email on rebre l'avís si algun enviament falla |

## 4. Executa la configuració inicial

A l'editor, selecciona la funció `configurarFullEnviament` al desplegable de funcions i prem ▶ Executar. La primera vegada Google et demanarà autoritzar els permisos (Compte no verificat → **Configuració avançada → Ves a "Gestor EE" (no segur)** — és normal en un script personal no publicat). Comprova al Sheet que:

- Han aparegut les columnes Q-U amb caselles de verificació.
- El desplegable de "Plantilla" (F/J/N) torna a funcionar.
- L'assumpte de `Plantilles!B1` ara conté `{{anyAcademic}}` en lloc de l'any fix.

## 5. Crea un Client ID d'OAuth (per al botó "Inicia sessió amb Google")

A [Google Cloud Console](https://console.cloud.google.com/) (pot ser qualsevol projecte, no cal que estigui vinculat a l'Apps Script):

1. **Pantalla de consentiment OAuth** → tipus "Extern" → afegeix el teu email com a usuari de prova.
2. **Credencials → Crear credencials → ID de client d'OAuth** → tipus "Aplicació web".
3. A "Orígens autoritzats de JavaScript" afegeix exactament l'origen de GitHub Pages, per exemple `https://el-teu-usuari.github.io` (sense barra final ni ruta). No cal cap URI de redirecció.
4. Copia el Client ID generat:
   - Enganxa'l a la propietat `GOOGLE_CLIENT_ID` del pas 3.
   - Enganxa'l també a `docs/js/config.js` (`GOOGLE_CLIENT_ID`).

## 6. Desplega com a aplicació web

A l'editor d'Apps Script: **Desplega → Nou desplegament**.

- Tipus: **Aplicació web**.
- Executar com: **Jo (el teu email)**.
- Qui hi té accés: **Qualsevol persona**.

Prem **Desplega** i autoritza si et torna a demanar. Copia la URL que acaba en `/exec` i enganxa-la a `docs/js/config.js` (`EXEC_URL`).

> Quan editis `Code.gs` més endavant, fes servir **Gestionar desplegaments → Edita → Versió nova** perquè la URL `/exec` no canviï.

## 7. Activa GitHub Pages

Al repositori de GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/docs`**. Guarda. Al cap d'uns segons la web serà accessible a `https://el-teu-usuari.github.io/Gestor-correos-EE/`.

Torna a comprovar que aquest origen coincideix exactament amb el que vas posar al pas 5.3.

## 8. Checklist de proves manuals

1. Obre la URL de Pages → surt el botó "Sign in with Google".
2. Inicia sessió amb un compte de la llista `ALLOWED_EMAILS` → hauria d'aparèixer el panell amb el teu email a la capçalera.
3. (Si tens un segon compte) prova a iniciar sessió amb un compte no autoritzat → hauria de sortir un missatge d'accés denegat, no una pantalla en blanc.
4. A "Excel oficial", enganxa l'enllaç real del teu Google Sheet → han d'aparèixer les dades del dashboard.
5. Edita una cel·la de prova a la graella (p. ex. una casella Q-U) → comprova que el canvi es reflecteix al Sheet real.
6. A "Enviar correus", tria un alumne i una plantilla → comprova la previsualització, edita-la i envia un correu de prova → comprova que arriba el text editat (no el de la plantilla original), que `Registre` registra `Estat=OK`, i que si la plantilla era una de les 3 principals, la casella i la data corresponents del Sheet s'actualitzen soles.
7. Prova un enviament amb un adjunt de Drive invàlid barrejat amb un de vàlid → el correu ha d'arribar amb l'adjunt vàlid, no sense cap.
8. A **Activadors** (rellotge, barra lateral de l'editor d'Apps Script) comprova que `enviament` segueix programat cada dia a les 8:00.
9. Mòbil: obre la URL de Pages al mòbil (o simula-ho amb les eines de desenvolupador) i navega per les 3 seccions.

## 9. Cada curs nou

Quan copiïs el Sheet per a un curs nou, no cal tornar a desplegar res:

1. Enganxa el nou enllaç a "Excel oficial" (es desa només al navegador, per curs/dispositiu).
2. Prem el botó de configuració (o crida l'acció `configurarFull` un cop) perquè el nou full tingui les columnes Q-U i el desplegable de plantilles.

L'any acadèmic de l'assumpte (`{{anyAcademic}}`) es calcula sol; no cal tocar-lo mai més.
