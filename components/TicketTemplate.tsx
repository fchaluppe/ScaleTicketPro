import React from 'react';
import { WeighingTicket } from '../types';

interface TicketTemplateProps {
  data: WeighingTicket | null;
  isPreview?: boolean;
}

export const TicketTemplate: React.FC<TicketTemplateProps> = ({ data, isPreview = false }) => {
  if (!data) return null;

  // Render logic differs for Preview (On Screen) vs Print (Hidden until print)
  
  if (isPreview) {
    // PREVIEW MODE: Visible card, styled to look like 80mm thermal paper
    // 80mm is approx 300-320px on screen depending on DPI, we set a fixed width relative to that.
    return (
      <div id="ticket-preview" className="flex flex-col bg-white text-black font-mono p-2 shadow-sm border border-gray-200 mx-auto w-[80mm] min-h-[150mm] relative">
         <TicketContent data={data} />
      </div>
    );
  }

  // PRINT MODE: Hidden on screen, Fixed full page on print
  return (
    <div id="printable-ticket" className="hidden print:flex flex-col w-full h-full p-2 font-mono text-black bg-white">
      <TicketContent data={data} />
    </div>
  );
};

// Internal component to share layout logic
const TicketContent: React.FC<{ data: WeighingTicket }> = ({ data }) => {
  // Calculations for specific fields
  // 1. Gross (Entrada) = Calculated Gross (Load + Truck)
  // 2. Tare (Saída) = Truck Tare
  // 3. Peso Aferido = Gross - Tare
  
  const pesoAferido = data.grossWeightCalculated - data.truckTareWeight;

  return (
    <>
      {/* Header */}
      <div className="w-full text-center border-b border-black pb-2 mb-2">
        <h1 className="text-sm font-normal uppercase leading-tight">Balança Rodoviária Lagoinha</h1>
        <p className="text-[10px] mt-1 leading-tight">Rua Antonio Fernandes Figueroa, 1166<br/>Ribeirão Preto, SP, Brasil</p>
      </div>

      {/* Info Grid - Reorganized for narrow width */}
      <div className="flex flex-col space-y-1 mb-2 text-[10px] border-b border-dashed border-black pb-2">
        <div className="flex flex-col">
          <div className="flex justify-between">
             <span>NÚMERO:</span>
             <span className="font-normal">{data.id || 'PENDENTE'}</span>
          </div>
          <div className="flex justify-between">
             <span>DATA:</span>
             <span>{new Date(data.issueTimestamp).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="flex justify-between">
            <span>PLACA:</span>
            <span className="font-normal">{data.truckPlateNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>HORA:</span>
            <span>{new Date(data.issueTimestamp).toLocaleTimeString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex justify-between">
             <span>REF. NOTA:</span>
             <span className="font-normal">{data.invoiceId}</span>
        </div>
      </div>

      {/* Weights Section - Specific 3 Items Layout */}
      <div className="flex-grow flex flex-col justify-start space-y-2 text-[10px]">
        
        {/* 1) Pesagem Bruta Entrada */}
        <div className="flex flex-col">
          <span className="text-[9px]">1) Pesagem Bruta Entrada</span>
          <span className="font-normal text-[9px] text-right">{data.grossWeightCalculated.toLocaleString('pt-BR')} kg</span>
        </div>

        {/* 2) Tara saída (caminhão) */}
        <div className="flex flex-col">
           <span className="text-[9px]">2) Tara Saída (Caminhão)</span>
           <span className="font-normal text-[9px] text-right">{data.truckTareWeight.toLocaleString('pt-BR')} kg</span>
        </div>

        {/* 3) Peso Aferido Mercadoria */}
        <div className="flex flex-col pt-1">
           <span className="text-[9px]">3) Peso Aferido Mercadoria</span>
           <span className="font-normal text-[9px] text-right">{pesoAferido.toLocaleString('pt-BR')} kg</span>
        </div>

      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 text-center text-[9px] border-t border-black">
        <p>Assinatura Autorizada</p>
        <p className="mt-4">__________________________</p>
      </div>
    </>
  );
};