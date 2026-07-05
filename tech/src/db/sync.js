/**
 * sync.js
 *
 * Drains the IndexedDB mutation outbox against the Frappe REST API
 * whenever the browser is online. Called on `online` events, on app
 * foreground, and via the periodic Workbox background sync tag.
 */

import * as api from '../api/client.js';
import {
  getQueuedMutations,
  removeMutation,
  bumpMutationAttempts,
  getDB,
  markPhotoSynced,
} from './offlineStore.js';

const MAX_ATTEMPTS = 8;

export async function syncNow({ onProgress } = {}) {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const mutations = await getQueuedMutations();
  let synced = 0;
  let failed = 0;

  for (const mutation of mutations) {
    try {
      await applyMutation(mutation);
      await removeMutation(mutation.id);
      synced += 1;
    } catch (err) {
      failed += 1;
      await bumpMutationAttempts(mutation.id);
      // Give up after MAX_ATTEMPTS and leave it queued but flagged for
      // manual review from the Settings > Sync Status screen.
      if (mutation.attempts + 1 >= MAX_ATTEMPTS) {
        console.error(`Mutation ${mutation.id} exceeded retry limit`, err);
      }
    }
    onProgress?.({ total: mutations.length, synced, failed });
  }

  return { synced, failed };
}

async function applyMutation(mutation) {
  switch (mutation.type) {
    case 'TIME_ACTION':
      return api.submitTimeAction(mutation.payload);

    case 'UPDATE_NOTES':
      return api.updateNotes(mutation.payload);

    case 'UPLOAD_PHOTO': {
      const db = await getDB();
      const photo = await db.get('photos', mutation.payload.localId);
      if (!photo || photo.synced) return; // already handled
      const result = await api.uploadPhoto({
        appointmentName: photo.appointmentName,
        blob: photo.blob,
        caption: photo.caption,
      });
      await markPhotoSynced(mutation.payload.localId, result?.message?.file_url);
      return result;
    }

    default:
      throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
}

export function registerSyncListeners() {
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) syncNow();
  });
  // Fires once at load in case mutations queued while the PWA was closed.
  if (navigator.onLine) syncNow();
}
