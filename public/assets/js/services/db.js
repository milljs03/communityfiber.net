import { db } from '../config/firebase-config.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Fetches all active internet plans from Firestore.
 * Expects a collection named 'plans'.
 * @returns {Promise<Array>} Array of plan objects
 */
export async function getPlans() {
    try {
        const plansRef = collection(db, 'plans');
        // Sort by price ascending so they appear in order
        const q = query(plansRef, orderBy("price", "asc"));
        
        const querySnapshot = await getDocs(q);
        
        const plans = [];
        querySnapshot.forEach((doc) => {
            plans.push({ id: doc.id, ...doc.data() });
        });
        
        return plans;
    } catch (error) {
        console.error("Error fetching plans:", error);
        throw error; // Propagate error to the UI layer
    }
}