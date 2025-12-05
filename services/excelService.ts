
import * as XLSX from 'xlsx';
import { InventoryItem } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const exportToExcel = async (items: InventoryItem[], fileName: string = '库存导出.xlsx') => {
  // 1. Format data for Excel
  const data = items.map(item => ({
    '商品名称': item.name,
    '商品编码': item.productId,
    '分类': item.category,
    '数量': item.quantity,
    '添加时间': new Date(item.timestamp).toLocaleString('zh-CN'),
  }));

  // 2. Create a worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 3. Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "库存列表");

  // 4. Handle Export based on Platform
  if (Capacitor.isNativePlatform()) {
    // --- Android/Native Export Logic ---
    try {
      // Step A: Request Permissions (Critical for Android 10+)
      try {
        const status = await Filesystem.requestPermissions();
        if (status.publicStorage !== 'granted') {
           // We continue anyway because 'Cache' directory might not strictly need it,
           // but asking is safer.
           console.log("Storage permission status:", status);
        }
      } catch (permError) {
        console.warn("Permission request failed or skipped:", permError);
      }

      // Step B: Generate Base64
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      
      // Step C: Write to Cache Directory
      // Note: Using Directory.Cache avoids clogging up user's Documents and is safer for sharing
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true 
      });

      console.log("File saved to:", savedFile.uri);

      // Step D: Open Share Sheet
      await Share.share({
        title: '导出库存数据',
        text: `库存数据报表 (${items.length}条记录)`,
        url: savedFile.uri,
        dialogTitle: '分享或保存 Excel',
      });

    } catch (error: any) {
      console.error("Native export failed:", error);
      // Show explicit error on phone screen
      alert(`导出失败: ${error.message || JSON.stringify(error)}`);
    }

  } else {
    // --- Web/Browser Export Logic ---
    XLSX.writeFile(workbook, fileName);
  }
};
