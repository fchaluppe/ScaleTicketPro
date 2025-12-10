import { WeighingTicket, Truck } from '../types';
import { MOCK_TRUCKS } from '../constants';

// Keys for localStorage
const TICKETS_STORAGE_KEY = 'weighing_tickets_db';

/**
 * Simulates fetching the Trucks collection
 */
export const fetchTrucks = async (): Promise<Truck[]> => {
  return new Promise((resolve) => {
    // Simulate network latency
    setTimeout(() => {
      resolve(MOCK_TRUCKS);
    }, 500);
  });
};

/**
 * Simulates saving a ticket to the WeighingTickets collection
 */
export const saveTicket = async (ticket: WeighingTicket): Promise<WeighingTicket> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        const stored = localStorage.getItem(TICKETS_STORAGE_KEY);
        const currentTickets: WeighingTicket[] = stored ? JSON.parse(stored) : [];
        
        // Do not overwrite issueTimestamp with Date.now(); use the one passed in the ticket object
        const newTicket = { 
          ...ticket, 
          id: `TKT-${Date.now().toString().slice(-6)}` // Auto-generate simple ID
        };
        
        currentTickets.push(newTicket);
        localStorage.setItem(TICKETS_STORAGE_KEY, JSON.stringify(currentTickets));
        
        console.log("Firestore Mock: Ticket saved successfully", newTicket);
        resolve(newTicket);
      } catch (e) {
        reject(e);
      }
    }, 800); // Simulate network write delay
  });
};

/**
 * Simulates fetching recent tickets
 */
export const fetchRecentTickets = async (): Promise<WeighingTicket[]> => {
  const stored = localStorage.getItem(TICKETS_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};