import { db } from './firebase';
import {
    collection,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    orderBy,
    limit,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'firebase/firestore';

/**
 * Add a new document to a collection
 * @param {string} collectionName 
 * @param {Object} data 
 * @returns {Promise<string>} New document ID
 */
export async function addDocument(collectionName, data) {
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error(`Error adding document to ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Set a document with a specific ID (overwrite or create)
 * @param {string} collectionName 
 * @param {string} id 
 * @param {Object} data 
 */
export async function setDocument(collectionName, id, data) {
    try {
        await setDoc(doc(db, collectionName, id), {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error(`Error setting document ${id} in ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Delete a document
 * @param {string} collectionName 
 * @param {string} id 
 */
export async function deleteDocument(collectionName, id) {
    try {
        await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
        console.error(`Error deleting document ${id} from ${collectionName}:`, error);
        throw error;
    }
}
