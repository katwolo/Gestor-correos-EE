# Desplegament del Gestor EE (web + backend)

Aquest projecte té dues meitats:

- **Backend**: `Code.gs` + `appsscript.json`, que s'han d'enganxar manualment a un projecte d'Apps Script lligat al teu Google Sheet oficial. No es pot desplegar automàticament des d'aquí — són passos que has de fer tu a la interfície de Google.
- **Frontend**: la carpeta `docs/`, pensada per servir-se com a lloc estàtic amb GitHub Pages.

L'accés a la web es protegeix amb una contrasenya simple que tu tries (Script Property `APP_PASSWORD`) — no fa falta cap login de Google ni crear res a Google Cloud Console.

Segueix els passos en ordre. Els cursos següents només cal repetir el pas 8 (canviar d'Sheet).

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
| `APP_PASSWORD` | La contrasenya que triïs per entrar a la web (només l'has de saber tu) |
| `TEACHER_NOTIFY_EMAIL` | (opcional) email on rebre l'avís si algun enviament de correu falla |

## 4. Executa la configuració inicial

A l'editor, selecciona la funció `configurarFullEnviament` al desplegable de funcions i prem ▶ Executar. La primera vegada Google et demanarà autoritzar els permisos (Compte no verificat → **Configuració avançada → Ves a "Gestor EE" (no segur)** — és normal en un script personal no publicat). Comprova al Sheet que:

- Han aparegut les capçaleres i caselles de verificació a "Enviament" (columnes E, I, M i Q-U).
- El full "Plantilles" té les capçaleres i 3 plantilles d'exemple a partir de la fila 5.
- El desplegable de "Plantilla" (F/J/N a "Enviament") funciona.
- L'assumpte de `Plantilles!B1` conté `{{anyAcademic}}`.

## 5. Desplega com a aplicació web

A l'editor d'Apps Script: **Desplega → Nou desplegament**.

- Tipus: **Aplicació web**.
- Executar com: **Jo (el teu email)**.
- Qui hi té accés: **Qualsevol persona**.

Prem **Desplega** i autoritza si et torna a demanar. Copia la URL que acaba en `/exec` i enganxa-la a `docs/js/config.js` (`EXEC_URL`).

> Quan editis `Code.gs` més endavant, fes servir **Gestionar desplegaments → Edita → Versió nova** perquè la URL `/exec` no canviï.

## 6. Activa GitHub Pages

Al repositori de GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/docs`**. Guarda. Al cap d'uns segons la web serà accessible a `https://el-teu-usuari.github.io/nom-del-repositori/`.

## 7. Checklist de proves manuals

1. Obre la URL de Pages → surt la pantalla demanant la contrasenya.
2. Introdueix la contrasenya correcta (`APP_PASSWORD`) → hauria d'aparèixer el panell principal.
3. Prova amb una contrasenya incorrecta → ha de sortir "Contrasenya incorrecta", no una pantalla en blanc.
4. A "Excel oficial", enganxa l'enllaç real del teu Google Sheet → han d'aparèixer les dades del dashboard.
5. Edita una cel·la de prova a la graella (p. ex. una casella Q-U) → comprova que el canvi es reflecteix al Sheet real.
6. A "Enviar correus", tria un alumne i una plantilla → comprova la previsualització, edita-la i envia un correu de prova → comprova que arriba el text editat (no el de la plantilla original), que `Registre` registra `Estat=OK`, i que si la plantilla era una de les 3 principals, la casella i la data corresponents del Sheet s'actualitzen soles.
7. Prova un enviament amb un adjunt de Drive invàlid barrejat amb un de vàlid → el correu ha d'arribar amb l'adjunt vàlid, no sense cap.
8. A **Activadors** (rellotge, barra lateral de l'editor d'Apps Script) comprova que `enviament` segueix programat cada dia a les 8:00.
9. Mòbil: obre la URL de Pages al mòbil (o simula-ho amb les eines de desenvolupador) i navega per les 3 seccions.

## 8. Cada curs nou

Quan copiïs el Sheet per a un curs nou, no cal tornar a desplegar res:

1. Enganxa el nou enllaç a "Excel oficial" (es desa només al navegador, per curs/dispositiu).
2. Prem el botó "⚙️ Configurar aquest full" perquè el nou full tingui les columnes Q-U i el desplegable de plantilles.

L'any acadèmic de l'assumpte (`{{anyAcademic}}`) es calcula sol; no cal tocar-lo mai més.

## Nota sobre seguretat

Aquesta contrasenya és una protecció senzilla, pensada per a un ús personal (que ningú sense l'enllaç i la contrasenya pugui veure les dades dels teus alumnes), no un sistema d'autenticació robust — es transmet a cada crida i es guarda només en memòria del navegador (es perd en tancar la pestanya). No la reutilitzis d'altres serveis i canvia-la (Script Property `APP_PASSWORD`) si mai sospites que s'ha filtrat.
