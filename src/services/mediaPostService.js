const DATABASE_NAME = 'legal-eagle-profile-media';
const DATABASE_VERSION = 1;
const STORE_NAME = 'posts';

let databasePromise;

function openDatabase() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('This browser does not support local media storage.'));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('profileKey', 'profileKey', { unique: false });
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => reject(new Error('Could not open local media storage.'));
      request.onblocked = () => reject(new Error('Local media storage is busy in another tab. Close other Legal Eagle tabs and try again.'));
    });
  }

  return databasePromise;
}

function profileKey(profileType, profileId) {
  if (!['lawyer', 'firm'].includes(profileType) || !profileId) {
    throw new Error('A valid lawyer or firm profile is required.');
  }
  return `${profileType}:${profileId}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    || `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listMediaPosts(profileType, profileId) {
  const key = profileKey(profileType, profileId);
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).index('profileKey').getAll(key);

    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    request.onerror = () => reject(new Error('Could not load profile posts.'));
  });
}

export async function createMediaPost(profileType, profileId, { caption, mediaBlob, mediaType }) {
  const key = profileKey(profileType, profileId);
  if (!(mediaBlob instanceof Blob) || !['image', 'video'].includes(mediaType)) {
    throw new Error('Choose a valid photo or video before posting.');
  }

  const database = await openDatabase();
  const post = {
    id: createId(),
    profileKey: key,
    caption: caption.trim(),
    mediaBlob,
    mediaType,
    createdAt: new Date().toISOString(),
  };

  await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).add(post);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(new Error('Could not save this post in local media storage.'));
    transaction.onabort = () => reject(new Error('Saving this post was interrupted.'));
  });

  return post;
}

export async function deleteMediaPost(profileType, profileId, postId) {
  const key = profileKey(profileType, profileId);
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    let deleted = false;
    const request = store.get(postId);

    request.onsuccess = () => {
      if (request.result?.profileKey === key) {
        store.delete(postId);
        deleted = true;
      }
    };
    transaction.oncomplete = () => resolve(deleted);
    transaction.onerror = () => reject(new Error('Could not delete this post.'));
    transaction.onabort = () => reject(new Error('Deleting this post was interrupted.'));
  });
}
