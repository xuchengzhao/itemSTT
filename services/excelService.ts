import * as XLSX from 'xlsx';
import { InventoryItem } from '../types';

export const exportToExcel = (items: InventoryItem[], fileName: string = '库存导出.xlsx') => {
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

  // 4. Generate buffer and trigger download
  XLSX.writeFile(workbook, fileName);
};