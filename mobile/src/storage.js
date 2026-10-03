import { Capacitor } from '@capacitor/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
const memory=new Map();
// The plugin's web implementation is intentionally never used for credentials.
export const storage={
  async getItem(key){return Capacitor.isNativePlatform()?SecureStorage.getItem(`mockmob_${key}`):memory.get(key) || null;},
  async setItem(key,value){if(Capacitor.isNativePlatform()) await SecureStorage.setItem(`mockmob_${key}`,value);else memory.set(key,value);},
  async removeItem(key){if(Capacitor.isNativePlatform()) await SecureStorage.removeItem(`mockmob_${key}`);else memory.delete(key);},
};
