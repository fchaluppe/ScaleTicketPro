import { Truck } from './types';

// Configuration Collection: Trucks
// Specific definitions based on requirements:
// TRUCK: Tare 9960 kg (For loads <= 15000)
// CARRETA: Tare 9900 kg (For loads > 15000)
export const MOCK_TRUCKS: Truck[] = [
  { 
    truckId: 'TRK-STD-01', 
    plateNumber: 'TRUCK', 
    tareWeight: 9960, 
    maxCapacity: 26000, // 9960 + 15000 = 24960, so 26000 covers it
    driverName: 'Auto Select 1' 
  },
  { 
    truckId: 'CRT-HVY-01', 
    plateNumber: 'CARRETA', 
    tareWeight: 9900, 
    maxCapacity: 50000, // High capacity for heavy loads
    driverName: 'Auto Select 2' 
  },
  // Keeping a generic one just in case, but the logic targets the names above
  { truckId: 'TRK-GEN-03', plateNumber: 'GENERIC-01', tareWeight: 5000, maxCapacity: 10000, driverName: 'Spare Driver' },
];

export const APP_NAME = "ScaleTicket Pro Studio";