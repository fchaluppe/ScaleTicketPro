import { ParsingResult } from '../types';

export const parseInvoiceXml = async (file: File): Promise<ParsingResult> => {
  try {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    // Check for parsing errors
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      return { invoiceId: null, netWeight: null, error: "Formato de arquivo XML inválido." };
    }

    // Helper function to extract value by strict path
    const getTagValueByPath = (doc: Document, path: string): string | null => {
      const parts = path.split('/').filter(p => p.length > 0);
      let current: Element | Document = doc;

      for (const part of parts) {
        // Find the specific tag within the current context
        const collection = current.getElementsByTagName(part);
        if (collection.length === 0) {
          return null;
        }
        // Move down the tree
        current = collection[0];
      }
      return current.textContent?.trim() || null;
    };

    // Helper function to find the first occurrence of a value from a list of possible tags (Legacy/Fallback)
    const getTagValue = (tags: string[]): string | null => {
      for (const tag of tags) {
        const collection = xmlDoc.getElementsByTagName(tag);
        if (collection.length > 0 && collection[0].textContent) {
          return collection[0].textContent.trim();
        }
      }
      return null;
    };

    // Extract Invoice ID
    // CTe typically uses cCT or nCT. NFe uses nNF.
    const invoiceId = getTagValue(["cCT", "nCT", "InvoiceID", "NF", "CT", "nNF", "id", "number"]);
    
    // Extract Invoice Date (Emission Date)
    // Priority: Strict Path /cteProc/CTe/infCte/ide/dhEmi
    let invoiceDateRaw = getTagValueByPath(xmlDoc, '/cteProc/CTe/infCte/ide/dhEmi');

    // Fallback Path: /CTe/infCte/ide/dhEmi (If no cteProc wrapper)
    if (!invoiceDateRaw) {
        invoiceDateRaw = getTagValueByPath(xmlDoc, '/CTe/infCte/ide/dhEmi');
    }

    // Fallback: Generic tag search (e.g. for NFe)
    if (!invoiceDateRaw) {
        invoiceDateRaw = getTagValue(["dhEmi", "dEmi", "IssueDate", "Date"]);
    }

    // Format Date to YYYY-MM-DD HH:MM
    let invoiceDate: string | null = null;
    if (invoiceDateRaw) {
        const d = new Date(invoiceDateRaw);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            invoiceDate = `${year}-${month}-${day} ${hours}:${minutes}`;
        } else {
            // Return raw if parsing failed
            invoiceDate = invoiceDateRaw;
        }
    }

    // --- Extract Date from Filename ---
    let filenameDate: string | null = null;
    const filename = file.name;
    
    // Regex for YYYY-MM-DD or YYYY.MM.DD
    const yyyyMmDd = filename.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    // Regex for DD-MM-YYYY or DD.MM.YYYY
    const ddMmYyyy = filename.match(/(\d{2})[-.](\d{2})[-.](\d{4})/);

    if (yyyyMmDd) {
        // yyyyMmDd[0] is full match, 1 is year, 2 is month, 3 is day
        // Construct ISO string part, add time to ensure local parsing consistency
        filenameDate = `${yyyyMmDd[1]}-${yyyyMmDd[2]}-${yyyyMmDd[3]} 12:00`; 
    } else if (ddMmYyyy) {
        // ddMmYyyy[1] is day, 2 is month, 3 is year
        filenameDate = `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]} 12:00`;
    }

    // Extract Net Weight
    let netWeightString: string | null = null;

    // Strategy 1: CTe Specific (Contextual Search)
    // CTe stores weights in <infQ> lists. We must find the one where <tpMed> is "PESO REAL".
    const infQList = xmlDoc.getElementsByTagName("infQ");
    if (infQList.length > 0) {
      for (let i = 0; i < infQList.length; i++) {
        const item = infQList[i];
        const tpMed = item.getElementsByTagName("tpMed")[0]?.textContent?.trim().toUpperCase();
        const qCarga = item.getElementsByTagName("qCarga")[0]?.textContent?.trim();

        if (tpMed === "PESO REAL" && qCarga) {
          netWeightString = qCarga;
          break; // Found the specific weight, stop searching
        }
      }
    }

    // Strategy 2: NFe / Generic Fallback (Direct Tag Search)
    if (!netWeightString) {
      netWeightString = getTagValue(["PesoReal", "pesoReal", "PESO_REAL", "NetWeight", "Weight", "pesoL", "Net", "qCarga"]);
    }

    // --- Extract License Plate (PLACA) ---
    // Look into <ObsCont> tags usually found in CTe
    let extractedPlate: string | null = null;
    const obsContList = xmlDoc.getElementsByTagName("ObsCont");
    const plateRegex = /[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/; 

    if (obsContList.length > 0) {
      for (let i = 0; i < obsContList.length; i++) {
        const item = obsContList[i];
        const xCampo = item.getAttribute("xCampo")?.toUpperCase() || "";
        
        // Check if this observation field is related to "PLACAS"
        if (xCampo.includes("PLACA")) {
          const xTexto = item.getElementsByTagName("xTexto")[0]?.textContent || "";
          const match = xTexto.match(plateRegex);
          if (match) {
            extractedPlate = match[0];
            break; // Stop at first valid plate found
          }
        }
      }
    }

    if (!invoiceId || !netWeightString) {
      const missing = [];
      if (!invoiceId) missing.push("ID da Nota (tags buscadas: cCT, nCT, InvoiceID, NF...)");
      if (!netWeightString) missing.push("Peso Líquido (tags buscadas: tpMed='PESO REAL', ou tags: PesoReal, pesoL...)");
      
      return { 
        invoiceId: invoiceId || null, 
        netWeight: netWeightString ? parseFloat(netWeightString) : null,
        invoiceDate: invoiceDate || null,
        extractedPlate: extractedPlate,
        filenameDate: filenameDate,
        error: `Dados obrigatórios faltando: ${missing.join(', ')}` 
      };
    }

    const netWeight = parseFloat(netWeightString);
    if (isNaN(netWeight)) {
      return { invoiceId, netWeight: null, error: "Peso Líquido não é um número válido." };
    }

    return { invoiceId, netWeight, invoiceDate, extractedPlate, filenameDate };

  } catch (err) {
    console.error("XML Parsing Error:", err);
    return { invoiceId: null, netWeight: null, error: "Falha ao ler o arquivo." };
  }
};