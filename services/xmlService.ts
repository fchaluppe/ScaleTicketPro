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

    // Helper function to find the first occurrence of a value from a list of possible tags
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
    const invoiceDate = getTagValue(["dhEmi", "dEmi", "IssueDate", "Date"]);

    // Extract Net Weight
    let netWeightString: string | null = null;

    // Strategy 1: CTe Specific (Contextual Search)
    // CTe stores weights in <infQ> lists. We must find the one where <tpMed> is "PESO REAL".
    // Otherwise we might pick up the quantity of items (e.g., 20 BIG BAGS) instead of weight.
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
    // If we didn't find "PESO REAL" inside an infQ structure, look for standard weight tags.
    if (!netWeightString) {
      netWeightString = getTagValue(["PesoReal", "pesoReal", "PESO_REAL", "NetWeight", "Weight", "pesoL", "Net", "qCarga"]);
    }

    // --- Extract License Plate (PLACA) ---
    // Look into <ObsCont> tags usually found in CTe
    let extractedPlate: string | null = null;
    const obsContList = xmlDoc.getElementsByTagName("ObsCont");
    // Regex for Brazilian plates: AAA9999 (Old) or AAA9A99 (Mercosul)
    // Matches 3 letters, then a digit, then alphanumeric, then 2 digits.
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
        error: `Dados obrigatórios faltando: ${missing.join(', ')}` 
      };
    }

    const netWeight = parseFloat(netWeightString);
    if (isNaN(netWeight)) {
      return { invoiceId, netWeight: null, error: "Peso Líquido não é um número válido." };
    }

    return { invoiceId, netWeight, invoiceDate, extractedPlate };

  } catch (err) {
    console.error("XML Parsing Error:", err);
    return { invoiceId: null, netWeight: null, error: "Falha ao ler o arquivo." };
  }
};