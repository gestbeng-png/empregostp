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
 * Fetch all documents from a collection
 * @param {string} collectionName 
 * @returns {Promise<Array>} List of documents with IDs
 */
export async function getAllDocuments(collectionName) {
    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        return data;
    } catch (error) {
        console.error(`Error fetching documents from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Fetch a single document by ID
 * @param {string} collectionName 
 * @param {string} id 
 * @returns {Promise<Object>} Document data or null
 */
export async function getDocumentById(collectionName, id) {
    try {
        const docRef = doc(db, collectionName, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        } else {
            return null;
        }
    } catch (error) {
        console.error(`Error fetching document ${id} from ${collectionName}:`, error);
        throw error;
    }
}

/**
 * Fetch documents with a specific condition
 * @param {string} collectionName 
 * @param {string} field 
 * @param {string} operator 
 * @param {any} value 
 * @returns {Promise<Array>} List of matching documents
 */
export async function getDocumentsByQuery(collectionName, field, operator, value) {
    try {
        const q = query(collection(db, collectionName), where(field, operator, value));
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
        });
        return data;
    } catch (error) {
        console.error(`Error querying ${collectionName}:`, error);
        throw error;
    }
}

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
 * Update a document
 * @param {string} collectionName 
 * @param {string} id 
 * @param {Object} data 
 */
export async function updateDocument(collectionName, id, data) {
    try {
        const docRef = doc(db, collectionName, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    } catch (error) {
        console.error(`Error updating document ${id} in ${collectionName}:`, error);
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
