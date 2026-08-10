import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { SmartDevice, AutomationRule } from '../types';

const DEVICES_COLLECTION = 'devices';
const AUTOMATIONS_COLLECTION = 'automations';

/**
 * Subscribe to real-time updates for all smart home devices across all connected clients.
 */
export function subscribeToDevices(
  onUpdate: (devices: SmartDevice[]) => void,
  onError?: (err: Error) => void
): () => void {
  const devicesColRef = collection(db, DEVICES_COLLECTION);
  
  return onSnapshot(
    devicesColRef,
    (snapshot) => {
      const devicesList: SmartDevice[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        devicesList.push({
          id: docSnap.id,
          ...data,
        } as SmartDevice);
      });
      onUpdate(devicesList);
    },
    (error) => {
      console.error('Firestore subscribeToDevices error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Subscribe to real-time updates for automations/scenes.
 */
export function subscribeToAutomations(
  onUpdate: (automations: AutomationRule[]) => void,
  onError?: (err: Error) => void
): () => void {
  const automationsColRef = collection(db, AUTOMATIONS_COLLECTION);

  return onSnapshot(
    automationsColRef,
    (snapshot) => {
      const rulesList: AutomationRule[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rulesList.push({
          id: docSnap.id,
          ...data,
        } as AutomationRule);
      });
      onUpdate(rulesList);
    },
    (error) => {
      console.error('Firestore subscribeToAutomations error:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Save or overwrite a device document in Firestore.
 */
export async function saveDeviceToDb(device: SmartDevice): Promise<void> {
  const docRef = doc(db, DEVICES_COLLECTION, device.id);
  const deviceToSave = {
    ...device,
    customImageUrl: device.customImageUrl ? device.customImageUrl : '',
    customIcon: device.customIcon ? device.customIcon : '',
  };
  const cleanDevice = JSON.parse(JSON.stringify(deviceToSave));
  await setDoc(docRef, cleanDevice, { merge: true });
}

/**
 * Update partial device state in Firestore for real-time instant propagation.
 */
export async function updateDeviceStateInDb(
  deviceId: string, 
  updatedStatePartial: Partial<SmartDevice['state']>
): Promise<void> {
  const docRef = doc(db, DEVICES_COLLECTION, deviceId);
  const cleanState = JSON.parse(JSON.stringify(updatedStatePartial));
  await updateDoc(docRef, {
    state: cleanState,
  });
}

/**
 * Save multiple devices (e.g., from Smart Life Account transfer or JSON import) in batch.
 */
export async function saveBatchDevicesToDb(devices: SmartDevice[]): Promise<void> {
  if (!devices || devices.length === 0) return;
  
  const batch = writeBatch(db);
  devices.forEach((device) => {
    const docRef = doc(db, DEVICES_COLLECTION, device.id);
    const cleanDevice = JSON.parse(JSON.stringify({
      ...device,
      customImageUrl: device.customImageUrl ? device.customImageUrl : '',
      customIcon: device.customIcon ? device.customIcon : '',
    }));
    batch.set(docRef, cleanDevice, { merge: true });
  });

  await batch.commit();
}

/**
 * Delete a device document from Firestore.
 */
export async function deleteDeviceFromDb(deviceId: string): Promise<void> {
  if (!deviceId) return;
  try {
    const docRef = doc(db, DEVICES_COLLECTION, deviceId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting device ${deviceId} from Firestore:`, err);
    throw err;
  }
}

/**
 * Save or update an automation rule in Firestore.
 */
export async function saveAutomationToDb(automation: AutomationRule): Promise<void> {
  const docRef = doc(db, AUTOMATIONS_COLLECTION, automation.id);
  const cleanAutomation = JSON.parse(JSON.stringify(automation));
  await setDoc(docRef, cleanAutomation, { merge: true });
}

/**
 * Delete an automation rule from Firestore.
 */
export async function deleteAutomationFromDb(automationId: string): Promise<void> {
  const docRef = doc(db, AUTOMATIONS_COLLECTION, automationId);
  await deleteDoc(docRef);
}

/**
 * Seed initial default devices and automations if database collections are empty.
 */
export async function seedInitialDataIfEmpty(
  initialDevices: SmartDevice[],
  initialAutomations: AutomationRule[]
): Promise<void> {
  try {
    const devicesSnap = await getDocs(collection(db, DEVICES_COLLECTION));
    if (devicesSnap.empty) {
      console.log('Seeding initial smart devices to Firestore...');
      await saveBatchDevicesToDb(initialDevices);
    }

    const automationsSnap = await getDocs(collection(db, AUTOMATIONS_COLLECTION));
    if (automationsSnap.empty) {
      console.log('Seeding initial automations to Firestore...');
      const batch = writeBatch(db);
      initialAutomations.forEach((auto) => {
        const docRef = doc(db, AUTOMATIONS_COLLECTION, auto.id);
        batch.set(docRef, JSON.parse(JSON.stringify(auto)));
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error seeding initial data to Firestore:', error);
  }
}
