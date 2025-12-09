import React, { useState, useEffect, useRef } from 'react';
import { Upload, Truck as TruckIcon, Printer, AlertTriangle, FileText, RefreshCw, Download, X, CheckCircle } from 'lucide-react';
import { Truck, WeighingTicket, ParsingResult } from './types';
import { parseInvoiceXml } from './services/xmlService';
import { fetchTrucks, saveTicket } from './services/mockFirestore';
import { TicketTemplate } from './components/TicketTemplate';

const App: React.FC = () => {
  // --- State Management ---
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loadingTrucks, setLoadingTrucks] = useState(true);
  
  // Data Input State
  const [selectedTruckId, setSelectedTruckId] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<ParsingResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Process State
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastPrintedTicket, setLastPrintedTicket] = useState<WeighingTicket | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    // Load truck configuration on mount
    const loadData = async () => {
      try {
        const data = await fetchTrucks();
        setTrucks(data);
      } catch (err) {
        console.error("Failed to load trucks", err);
      } finally {
        setLoadingTrucks(false);
      }
    };
    loadData();
  }, []);

  // --- Derived State (Calculations) ---
  const selectedTruck = trucks.find(t => t.truckId === selectedTruckId);
  
  // Display theoretical gross weight (exact match) in the UI before printing
  const grossWeight = (invoiceData?.netWeight || 0) + (selectedTruck?.tareWeight || 0);
  
  const canIssue = !!selectedTruck && !!invoiceData?.invoiceId && !invoiceData.error;

  // --- Handlers ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setInvoiceData(null); // Reset previous data
    
    // Simulate reading UI delay for better UX
    setIsProcessing(true);
    
    try {
      const result = await parseInvoiceXml(file);
      if (result.error) {
        setUploadError(result.error);
      } else {
        setInvoiceData(result);

        // --- Automatic Vehicle Selection Logic ---
        if (result.netWeight !== null) {
          let targetPlate = '';
          
          if (result.netWeight <= 15000) {
            targetPlate = 'TRUCK'; // Should match plateNumber in constants
          } else {
            targetPlate = 'CARRETA'; // Should match plateNumber in constants
          }

          // Find the truck in the loaded list
          const autoSelectedTruck = trucks.find(t => t.plateNumber === targetPlate);
          
          if (autoSelectedTruck) {
            setSelectedTruckId(autoSelectedTruck.truckId);
            setFeedbackMessage(`Veículo selecionado automaticamente: ${targetPlate} (Baseado no peso ${result.netWeight}kg)`);
          } else {
            // Fallback if specific truck not found
            setFeedbackMessage(`Não foi possível selecionar automaticamente o veículo para a categoria de peso.`);
          }
        }
      }
    } catch (err) {
      setUploadError("Erro inesperado ao ler o arquivo.");
    } finally {
      setIsProcessing(false);
      // Reset file input so same file can be selected again if needed
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIssueTicket = async () => {
    if (!canIssue || !selectedTruck || !invoiceData?.invoiceId || invoiceData.netWeight === null) return;

    setIsProcessing(true);
    setFeedbackMessage(null);

    // --- Date & Time Calculation ---
    // Rule 1: Ticket Date = XML Date + 1 Day
    // Rule 2: Ticket Time = Random between 07:12:50 and 15:45:50
    
    let ticketDate = new Date(); // Fallback to now if XML date is missing

    if (invoiceData.invoiceDate) {
      const xmlDate = new Date(invoiceData.invoiceDate);
      if (!isNaN(xmlDate.getTime())) {
        ticketDate = xmlDate;
        // Add 1 day to the document date
        ticketDate.setDate(ticketDate.getDate() + 1);
      }
    }

    // Calculate Random Time
    // Start: 07:12:50
    const startHour = 7;
    const startMinute = 12;
    const startSecond = 50;
    const startTotalSeconds = startHour * 3600 + startMinute * 60 + startSecond; // 25970

    // End: 15:45:50
    const endHour = 15;
    const endMinute = 45;
    const endSecond = 50;
    const endTotalSeconds = endHour * 3600 + endMinute * 60 + endSecond; // 56750

    // Generate random seconds within range
    const randomSeconds = Math.floor(Math.random() * (endTotalSeconds - startTotalSeconds + 1)) + startTotalSeconds;

    // Convert back to HMS
    const h = Math.floor(randomSeconds / 3600);
    const m = Math.floor((randomSeconds % 3600) / 60);
    const s = randomSeconds % 60;

    // Set the random time on the ticket date object
    ticketDate.setHours(h, m, s, 0);
    
    const issueTimestamp = ticketDate.getTime();

    // --- Random Weight Variation Logic ---
    // Rule: Apply +/- 0.2% variation to Net Weight, but capped at +/- 20kg.
    
    // 1. Calculate random percentage factor between 0.998 (-0.2%) and 1.002 (+0.2%)
    const variationFactor = 0.998 + (Math.random() * 0.004);
    
    // 2. Calculate the potential delta based on percentage
    const rawDelta = (invoiceData.netWeight * variationFactor) - invoiceData.netWeight;
    
    // 3. Clamp the delta to +/- 20kg
    const clampedDelta = Math.max(-20, Math.min(20, rawDelta));

    // 4. Calculate simulated measured net weight
    const simulatedMeasuredNetWeight = invoiceData.netWeight + clampedDelta;
    
    // Calculate Final Gross Weight = Simulated Measured Net + Tare
    // Round to nearest integer for realistic scale display
    const randomizedGrossWeight = Math.round(simulatedMeasuredNetWeight + selectedTruck.tareWeight);

    const newTicket: WeighingTicket = {
      invoiceId: invoiceData.invoiceId,
      netWeightInvoice: invoiceData.netWeight,
      truckId: selectedTruck.truckId,
      // Prefer the plate extracted from XML, otherwise fallback to the generic truck plate
      truckPlateNumber: invoiceData.extractedPlate || selectedTruck.plateNumber,
      truckTareWeight: selectedTruck.tareWeight,
      grossWeightCalculated: randomizedGrossWeight, 
      issueTimestamp: issueTimestamp,
      ticketStatus: 'Printed'
    };

    try {
      const savedTicket = await saveTicket(newTicket);
      setLastPrintedTicket(savedTicket);
      setShowPreviewModal(true); // Open modal instead of printing directly
      setFeedbackMessage("Ticket gerado com sucesso.");
    } catch (err) {
      console.error(err);
      setFeedbackMessage("Erro ao salvar ticket no banco de dados.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('ticket-preview');
    if (!element) return;
    
    // @ts-ignore
    if (window.html2pdf) {
        const opt = {
            margin: 0,
            filename: `Ticket-${lastPrintedTicket?.id || 'New'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true },
            jsPDF: { unit: 'mm', format: [80, 160], orientation: 'portrait' }
        };
        // @ts-ignore
        window.html2pdf().from(element).set(opt).save();
    } else {
        alert("Biblioteca de PDF não carregada. Tente imprimir e 'Salvar como PDF'.");
    }
  };

  const handleReset = () => {
    setInvoiceData(null);
    setSelectedTruckId('');
    setUploadError(null);
    setFeedbackMessage(null);
    setLastPrintedTicket(null);
    setShowPreviewModal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      {/* Hidden Print Template - Used when window.print() is called */}
      <TicketTemplate data={lastPrintedTicket} isPreview={false} />

      {/* Main Header */}
      <header className="bg-slate-900 text-white p-4 shadow-lg print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TruckIcon className="w-8 h-8 text-blue-400" />
            <h1 className="text-2xl font-bold tracking-tight">ScaleTicket Pro</h1>
          </div>
          <button 
            onClick={handleReset}
            className="flex items-center space-x-2 text-sm bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Nova Sessão</span>
          </button>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 max-w-3xl mx-auto w-full print:hidden space-y-6">
        
        {/* DATA INPUT SECTION */}
        <div className="space-y-6">
          
          {/* 1. XML Upload */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-semibold flex items-center mb-4 text-slate-700">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Dados da Nota Fiscal
            </h2>
            
            <div className="relative border-2 border-dashed border-slate-300 rounded-lg p-6 hover:bg-slate-50 transition-colors text-center group cursor-pointer"
                 onClick={() => fileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload} 
                accept=".xml" 
                className="hidden" 
              />
              <div className="flex flex-col items-center">
                <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-500 mb-2 transition-colors" />
                <span className="text-sm font-medium text-slate-600">Clique para Enviar XML</span>
                <span className="text-xs text-slate-400 mt-1">Suporta formato padrão de NFe/CTe</span>
              </div>
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                {uploadError}
              </div>
            )}

            {/* Data Display */}
            {invoiceData?.invoiceId && (
              <div className="mt-6 space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Número da Nota/CTe</span>
                  <span className="font-mono font-bold text-slate-800">{invoiceData.invoiceId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Peso Líquido (Carga)</span>
                  <span className="font-mono font-bold text-slate-800">{invoiceData.netWeight?.toLocaleString()} kg</span>
                </div>
                {/* Visual confirmation of extracted plate if available */}
                {invoiceData.extractedPlate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Placa Detectada (XML)</span>
                    <span className="font-mono font-bold text-slate-800">{invoiceData.extractedPlate}</span>
                  </div>
                )}
                {/* Visual confirmation of auto-selected truck */}
                {selectedTruck && (
                   <div className="flex justify-between text-sm border-t border-blue-100 pt-2 mt-2">
                    <span className="text-slate-500">Veículo Detectado</span>
                    <span className="font-mono font-bold text-slate-800">{selectedTruck.plateNumber} (Tara: {selectedTruck.tareWeight}kg)</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS SECTION */}
        <div className="space-y-4 pt-2">
            <button
            onClick={handleIssueTicket}
            disabled={!canIssue || isProcessing}
            className={`w-full py-4 px-6 rounded-lg shadow-md flex items-center justify-center space-x-2 transition-all transform active:scale-95 ${
                canIssue && !isProcessing
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
            >
            {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
            ) : (
                <CheckCircle className="w-6 h-6" />
            )}
            <span className="font-bold text-lg">Emitir Ticket</span>
            </button>
            
            {!selectedTruck && (
            <p className="text-xs text-center text-slate-400">Aguardando arquivo XML para seleção automática de veículo</p>
            )}

            {feedbackMessage && (
            <div className="text-center text-sm font-medium text-green-600 animate-fade-in-up">
                {feedbackMessage}
            </div>
            )}
        </div>
      </main>

      {/* TICKET PREVIEW MODAL */}
      {showPreviewModal && lastPrintedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden">
          <div className="bg-slate-100 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-white p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                Ticket Gerado
              </h3>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-grow overflow-y-auto p-6 bg-slate-200 flex justify-center">
               <TicketTemplate data={lastPrintedTicket} isPreview={true} />
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-4 border-t border-slate-200 flex justify-end space-x-3">
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium transition-colors"
              >
                Fechar
              </button>
              <button 
                onClick={handlePrint}
                className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded shadow flex items-center font-medium transition-colors"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </button>
              <button 
                onClick={handleDownloadPdf}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded shadow flex items-center font-medium transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;