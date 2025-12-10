export interface Truck {
  truckId: string;
  plateNumber: string;
  tareWeight: number; // kg
  maxCapacity: number; // kg
  driverName?: string;
}

export type TicketStatus = 'Draft' | 'Printed' | 'Over-Capacity';

export interface WeighingTicket {
  id?: string;
  invoiceId: string;
  netWeightInvoice: number; // kg
  truckId: string;
  truckPlateNumber: string;
  truckTareWeight: number; // kg
  grossWeightCalculated: number; // kg
  issueTimestamp: number; // Unix timestamp
  ticketStatus: TicketStatus;
}

export interface ParsingResult {
  invoiceId: string | null;
  netWeight: number | null;
  invoiceDate?: string | null;
  extractedPlate?: string | null;
  filenameDate?: string | null;
  error?: string;
}