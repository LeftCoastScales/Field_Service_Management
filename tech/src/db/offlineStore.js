/**
 * offlineStore.js
 *
 * IndexedDB (via idb) wrapper providing:
 *  - jobs: cached "Today's Jobs" data for the logged-in technician
 *  - dayLog: the current chained-logic time tracking day log
 *  - notes: queued customer/internal note edits per appointment
 *  - photos: queued photo blobs per appointment, pending upload
 *  - mutationQueue: generic outbox for anything that needs to sync
 *
 * Everything here works with zero network connectivity. sync.js drains
 * mutationQueue against the Frappe REST API when the browser comes back online.
 */

import { openDB } from 'idb';

const DB_NAME = 'lcs-tech-pwa';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('jobs')) {
        db.createObjectStore('jobs', { keyPath: 'name' }); // Service Appointment name
      }
      if (!db.objectStoreNames.contains('dayLog')) {
        db.createObjectStore('dayLog', { keyPath: 'date' }); // one per calendar date
      }
      if (!db.objectStoreNames.contains('notes')) {
        db.createObjectStore('notes', { keyPath: 'appointmentName' });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'localId', autoIncrement: true });
        store.createIndex('byAppointment', 'appointmentName');
        store.createIndex('bySynced', 'synced');
      }
      if (!db.objectStoreNames.contains('mutationQueue')) {
        const store = db.createObjectStore('mutationQueue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('byCreatedAt', 'createdAt');
      }
    },
  });
}

// ---- Jobs cache -----------------------------------------------------------

export async function cacheJobs(jobs) {
  const db = await getDB();
  const tx = db.transaction('jobs', 'readwrite');
  await tx.store.clear();
  for (const job of jobs) await tx.store.put(job);
  await tx.done;
}

export async function getCachedJobs() {
  const db = await getDB();
  return db.getAll('jobs');
}

export async function getCachedJob(name) {
  const db = await getDB();
  return db.get('jobs', name);
}

// ---- Day log ----------------------------------------------------------

export async function saveDayLog(dayLog) {
  const db = await getDB();
  await db.put('dayLog', dayLog);
}

export async function loadDayLog(dateISO) {
  const db = await getDB();
  return db.get('dayLog', dateISO);
}

// ---- Notes --------------------------------------------------------------

export async function saveNoteDraft(appointmentName, { customerNotes, internalNotes }) {
  const db = await getDB();
  const existing = (await db.get('notes', appointmentName)) || { appointmentName };
  const record = {
    ...existing,
    customerNotes: customerNotes ?? existing.customerNotes ?? '',
    internalNotes: internalNotes ?? existing.internalNotes ?? '',
    updatedAt: new Date().toISOString(),
    synced: false,
  };
  await db.put('notes', record);
  await enqueueMutation({
    type: 'UPDATE_NOTES',
    payload: { appointmentName, customerNotes: record.customerNotes, internalNotes: record.internalNotes },
  });
  return record;
}

export async function getNoteDraft(appointmentName) {
  const db = await getDB();
  return db.get('notes', appointmentName);
}

// ---- Photos ---------------------------------------------------------------

/** Stores a photo blob locally and queues it for upload. Returns the local record. */
export async function addPhoto(appointmentName, blob, { caption = '' } = {}) {
  const db = await getDB();
  const record = {
    appointmentName,
    blob,
    caption,
    takenAt: new Date().toISOString(),
    synced: false,
  };
  const localId = await db.add('photos', record);
  await enqueueMutation({ type: 'UPLOAD_PHOTO', payload: { localId } });
  return { ...record, localId };
}

export async function getPhotosForAppointment(appointmentName) {
  const db = await getDB();
  return db.getAllFromIndex('photos', 'byAppointment', appointmentName);
}

export async function markPhotoSynced(localId, remoteFileUrl) {
  const db = await getDB();
  const record = await db.get('photos', localId);
  if (!record) return;
  record.synced = true;
  record.remoteFileUrl = remoteFileUrl;
  await db.put('photos', record);
}

// ---- Generic mutation outbox ------------------------------------------

export async function enqueueMutation(mutation) {
  const db = await getDB();
  await db.add('mutationQueue', { ...mutation, createdAt: new Date().toISOString(), attempts: 0 });
}

export async function getQueuedMutations() {
  const db = await getDB();
  return db.getAllFromIndex('mutationQueue', 'byCreatedAt');
}

export async function removeMutation(id) {
  const db = await getDB();
  await db.delete('mutationQueue', id);
}

export async function bumpMutationAttempts(id) {
  const db = await getDB();
  const record = await db.get('mutationQueue', id);
  if (!record) return;
  record.attempts += 1;
  record.lastAttemptAt = new Date().toISOString();
  await db.put('mutationQueue', record);
}
