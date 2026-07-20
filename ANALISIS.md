# Anàlisi del Gestor de correus EE

Fonts analitzades:
- Codi Apps Script (`Benvinguda.gs`, `Enviament.gs`, `Trigger.gs`), extret del PDF `Codi gestor EE`.
- Plantilla Google Sheets (`Correu EE.xlsx`), amb 3 fulls: `Enviament`, `Plantilles`, `Registre`.

## 1. Com funciona el sistema

**Full `Enviament`** (una fila per alumne/a, 16 columnes A:P):

| Columnes | Contingut |
|---|---|
| A-D | Nom alumne, correu alumne, nom tutor/a d'empresa, correu tutor/a |
| E-H | Bloc 1: casella ✅, nom de plantilla, adjunt (URL Drive), data |
| I-L | Bloc 2 (Seguiment): mateixa estructura |
| M-P | Bloc 3 (Valoració final): mateixa estructura |

Cada fila té 3 "blocs" independents (contacte inicial, seguiment, valoració final), cadascun amb la seva pròpia casella de marcatge, plantilla, adjunt opcional i data.

**Full `Plantilles`**: `B1` = assumpte base del correu (amb placeholder `{{nombreAlumno}}`). A partir de la fila 4 hi ha una taula amb `Nom plantilla | Cos del correu (HTML) | Destinatari` (Tutor/a, Alumnat o Ambdós). Actualment hi ha 8 plantilles: `contacteinicial`, `seguiment`, `valoració final`, `Ref 05 i Ref 06`, `Pròrroga`, `Conveni signat`, `Enregistrar hores`, `Altre conveni`.

**Full `Registre`**: log automàtic (Data, Hora, Destinatari, Assumpte, Plantilla usada) que s'omple cada vegada que s'envia un correu.

**Flux d'execució (`enviament()`):**
1. Llegeix totes les files de `Enviament`.
2. Per cada bloc marcat (✅) amb una plantilla indicada, busca la plantilla al mapa carregat de `Plantilles`.
3. Substitueix els placeholders `{{nombreAlumno}}`, `{{correoAlumno}}`, `{{nombreTutor}}`, `{{correoTutor}}` al cos i a l'assumpte.
4. Calcula destinataris segons el camp "Destinatari" de la plantilla.
5. Envia amb `GmailApp.sendEmail`, adjuntant fitxers de Drive si n'hi ha.
6. Registra l'enviament a `Registre` i desmarca la casella.

Un trigger diari (8:00) executa `enviament()` automàticament; `onOpen()` crea el menú, mostra un missatge de benvinguda un únic cop per usuari i crea el trigger un únic cop per projecte.

## 2. Problemes detectats

1. **Desplegable de "Plantilla" trencat (`#REF!`).** La validació de dades de les columnes F, J i N (llista desplegable de noms de plantilla) apunta a una referència eliminada (`#REF!`) en comptes del rang `Plantilles!A5:A12`. Ara mateix cal escriure el nom de la plantilla a mà, amb risc d'errors tipogràfics silenciosos (si el nom no coincideix exactament, l'enviament d'aquell bloc simplement no es fa, sense avís visible — només queda un `Logger.log`). **Cal recrear la validació de llista** apuntant al rang real de noms de plantilla.

2. **Funcions de menú no trobades al projecte.** `onOpen()` registra al menú "Tutorial" → `obrirTutorial` i "Esborrar historial" → `esborrarHistorial`, però cap d'aquestes dues funcions apareix als fitxers `.gs` proporcionats. Si realment no existeixen al projecte d'Apps Script, en clicar aquests ítems del menú Google Sheets mostrarà l'error "Script function not found". Si teniu aquests fitxers en algun altre lloc, útil compartir-los; si no, cal crear-los o treure'ls del menú.

3. **Errors d'enviament silenciats i casella desmarcada igualment.** Si `GmailApp.sendEmail` falla (quota de Gmail exhaurida, adreça invàlida, etc.), l'error només es registra amb `Logger.log` — visible només obrint manualment l'historial d'execucions de l'editor d'Apps Script, mai per al usuari des del full de càlcul. A més, com que el trigger diari s'executa sense supervisió, aquest error passaria completament desapercebut. Recomanació: registrar els errors també al full `Registre` (o notificar per correu a `ibustos@ieb.cat`) perquè no quedin invisibles.

4. **`cargarPlantilles` llegeix des de la fila 2 del full `Plantilles`.** El full té l'assumpte a la fila 1, dues files buides (2-3), la capçalera real a la fila 4 i les plantilles a partir de la fila 5. El codi (`hoja.getRange(2, 1, hoja.getLastRow() - 1, 3)`) funciona "de rebot" perquè les files 2-3 són buides i la fila 4 (capçalera "Nom plantilla"/"Cos del correu"/"Destinatari") es converteix en una entrada fantasma del mapa que mai coincidirà amb cap ús real. Funciona, però és fràgil: si en el futur s'escriu res a A2:C3 o es reordena el full, es trencaria silenciosament.

5. **Any escolar fixat a mà a l'assumpte.** `Plantilles!B1` = `"EE IEB {{nombreAlumno}} 25-26"` — l'any "25-26" és literal i cal canviar-lo manualment cada curs (es veu al `Registre` com barreja "24-25" i "25-26" d'anys anteriors). Es podria calcular dinàmicament (per exemple amb l'any acadèmic actual) per evitar oblidar-ho.

6. **Les columnes de data (H/L/P) no s'omplen automàticament.** Es fan servir com a "no enviar abans d'aquesta data" (`if (dataEnviament instanceof Date && dataEnviament > ara) continue;`), però el script mai escriu la data real d'enviament en aquesta columna — cal introduir-la a mà. Seria senzill que, en enviar correctament, el script hi escrigués la data actual, deixant un registre fiable sense feina manual extra.

7. **Adjunts: un ID invàlid descarta tots els adjunts de la fila/bloc.** Si `adjuntsStr` conté diversos enllaços de Drive separats per comes i un d'ells no és vàlid (o `extraerIdDeDrive` no troba cap ID), el `.map()` sencer llança una excepció i **cap** adjunt s'afegeix a aquell correu (no només el problemàtic). El correu s'envia igualment, però sense cap adjunt.

## 3. Resum

El sistema en si és sòlid i ben pensat (execució diària automàtica, plantilles reutilitzables amb placeholders, registre d'enviaments, protecció contra reenviaments duplicats via desmarcat de casella). Els punts més importants a corregir són el **desplegable de plantilles trencat** (punt 1) i la **visibilitat dels errors d'enviament** (punt 3), ja que ambdós poden provocar que un correu no s'enviï sense que ningú se n'adoni.
