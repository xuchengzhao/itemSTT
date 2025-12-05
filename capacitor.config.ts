import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
appId: 'com.voiceinventory.app',
appName: '语音库存',
webDir: 'dist',
server: {
androidScheme: 'https'
}
};
export default config;