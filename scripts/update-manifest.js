
import fs from 'fs';
import path from 'path';

const manifestPath = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');

// 检查文件是否存在
if (!fs.existsSync(manifestPath)) {
  console.log('❌ AndroidManifest.xml 未找到。请先运行 "npx cap add android" 生成安卓项目。');
  process.exit(0);
}

console.log('🔍 正在检查 Android 权限...');

let content = fs.readFileSync(manifestPath, 'utf8');

const permissions = [
  '<!-- 自动注入的权限 -->',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />',
  '<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />'
];

let addedCount = 0;
// 找到 <application> 标签的位置，我们将权限插入到它之前
const appTagIndex = content.indexOf('<application');

if (appTagIndex === -1) {
    console.error('❌ 无法在 Manifest 中找到 <application> 标签');
    process.exit(1);
}

// 准备插入的内容
let insertion = '';

permissions.forEach(perm => {
    // 只有当文件中不存在该权限时才添加
    if (!content.includes(perm)) {
        insertion += `    ${perm}\n`;
        addedCount++;
    }
});

if (addedCount > 0) {
    // 执行插入
    content = content.slice(0, appTagIndex) + insertion + content.slice(appTagIndex);
    console.log(`✅ 成功自动注入了 ${addedCount} 条权限`);
} else {
    console.log('✨ 所有权限已存在。');
}

// 修复 HTTP 图片加载问题 (启用 Cleartext Traffic)
// 检查 application 标签是否已经包含 android:usesCleartextTraffic
if (content.includes('<application') && !content.includes('android:usesCleartextTraffic="true"')) {
    // 将 <application 替换为 <application android:usesCleartextTraffic="true"
    content = content.replace('<application', '<application android:usesCleartextTraffic="true"');
    console.log('✅ 已启用 HTTP 明文传输 (Cleartext Traffic) 支持，解决图片加载问题');
}

// 写回文件
fs.writeFileSync(manifestPath, content);
