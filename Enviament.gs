function enviament(origen = "Manual") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Enviament");
  const hojaRegistro = prepararHojaRegistro();
  const hojaPlantilles = ss.getSheetByName("Plantilles");

  const assumpteBase = hojaPlantilles.getRange("B1").getValue() || "Missatge IEB";
  const plantilles = cargarPlantilles(hojaPlantilles);

  const ultimaFila = hoja.getLastRow();
  const dades = hoja.getRange(2, 1, ultimaFila - 1, 16).getValues(); // A:P
  const ara = new Date();

  const blocs = [
    { casella: 4, plantilla: 5, adjunt: 6, data: 7 },    // Bloc 1 (E-H)
    { casella: 8, plantilla: 9, adjunt: 10, data: 11 },  // Bloc 2 (I-L)
    { casella: 12, plantilla: 13, adjunt: 14, data: 15 } // Bloc 3 (M-P)
  ];

  for (let i = 0; i < dades.length; i++) {
    const fila = dades[i];
    const nomAlumne = fila[0];
    const correuAlumne = fila[1];
    const nomTutor = fila[2];
    const correuTutor = fila[3];

    for (const bloc of blocs) {
      const casellaMarcada = fila[bloc.casella];
      const plantillaKey = fila[bloc.plantilla];
      const adjuntsStr = fila[bloc.adjunt];
      const dataEnviament = fila[bloc.data];

      if (!casellaMarcada || !plantillaKey) continue;
      if (dataEnviament instanceof Date && dataEnviament > ara) continue;

      const plantillaObj = plantilles[plantillaKey.trim()];
      if (!plantillaObj || !plantillaObj.cos) {
        Logger.log(`Fila ${i + 2} plantilla "${plantillaKey}" no trobada.`);
        continue;
      }

      let cosHtml = plantillaObj.cos
        .replace(/{{\s*nombreAlumno\s*}}/gi, nomAlumne)
        .replace(/{{\s*correoAlumno\s*}}/gi, correuAlumne)
        .replace(/{{\s*nombreTutor\s*}}/gi, nomTutor)
        .replace(/{{\s*correoTutor\s*}}/gi, correuTutor);

      const assumpteFinal = assumpteBase
        .replace(/{{\s*nombreAlumno\s*}}/gi, nomAlumne)
        .replace(/{{\s*nombreTutor\s*}}/gi, nomTutor);

      const destinataris = [];

      switch (plantillaObj.destinatari) {
        case "alumnat":
          if (correuAlumne) destinataris.push(correuAlumne);
          break;
        case "ambdós":
          if (correuAlumne) destinataris.push(correuAlumne);
          if (correuTutor) destinataris.push(correuTutor);
          break;
        case "tutor/a":
        default:
          if (correuTutor) destinataris.push(correuTutor);
          break;
      }

      for (const destinatari of destinataris) {
        const opcions = {
          to: destinatari,
          subject: assumpteFinal,
          htmlBody: cosHtml,
        };

        if (adjuntsStr) {
          try {
            const adjunts = adjuntsStr.split(",").map(e => {
              const id = extraerIdDeDrive(e.trim());
              return DriveApp.getFileById(id).getBlob();
            });
            opcions.attachments = adjunts;
          } catch (err) {
            Logger.log(`Error adjuntant fitxers a fila ${i + 2}: ${err}`);
          }
        }

        try {
          GmailApp.sendEmail(opcions.to, opcions.subject, '', opcions);
          registrarEnvio(hojaRegistro, opcions.to, opcions.subject, plantillaKey.trim());
        } catch (error) {
          Logger.log(`Error enviant a ${opcions.to} fila ${i + 2}: ${error}`);
        }
      }

      hoja.getRange(i + 2, bloc.casella + 1).setValue(false); // Desmarcar casella
    }
  }
}

function prepararHojaRegistro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName("Registre");
  if (!hoja) {
    hoja = ss.insertSheet("Registre");
    hoja.appendRow(["Data", "Hora", "Destinatari", "Assumpte", "Missatge enviat"]);
  }
  return hoja;
}

function registrarEnvio(hoja, destinatari, assumpte, plantillaUsada) {
  const fecha = new Date();
  const dataStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy");
  const horaStr = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "HH:mm");
  hoja.appendRow([dataStr, horaStr, destinatari, assumpte, plantillaUsada]);
}

function cargarPlantilles(hoja) {
  if (!hoja) return {};
  const data = hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues();
  // A: Nom, B: Cos, C: Destinatari
  const plantillaMap = {};
  data.forEach(([nom, cos, destinatari]) => {
    if (nom && cos) {
      plantillaMap[nom.trim()] = {
        cos: cos,
        destinatari: destinatari ? destinatari.trim().toLowerCase() : "tutor/a"
      };
    }
  });
  return plantillaMap;
}

function extraerIdDeDrive(url) {
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}
