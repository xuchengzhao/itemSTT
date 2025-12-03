import React, { useState, useEffect } from 'react';
import { Plus, Download, Package, Trash2, FileSpreadsheet, Search, DownloadCloud } from 'lucide-react';
import { InventoryItem, Product } from './types';
import { PRODUCT_DATABASE } from './constants';
import { AddItemModal } from './components/AddItemModal';
import { exportToExcel } from './services/excelService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

// Component for the chart to separate concerns
const InventoryChart: React.FC<{ items: InventoryItem[] }> = ({ items }) => {
  // Aggregate data by category for visualization
  const data = items.reduce((acc, item) => {
    const existing = acc.find(d => d.name === item.category);
    if (existing) {
      existing.value += item.quantity;
    } else {
      acc.push({ name: item.category, value: item.quantity });
    }
    return acc;
  }, [] as { name: string, value: number }[]);

  if (data.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 h-64">
      <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">分类库存统计</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip 
            cursor={{ fill: '#f3f4f6' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="value" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
    });
  };

  const handleAddItem = (product: Product, quantity: number) => {
    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      productId: product.id,
      name: product.name,
      category: product.category,
      quantity: quantity,
      timestamp: Date.now(),
    };
    // Add to top of list
    setInventory(prev => [newItem, ...prev]);
  };

  const handleRemoveItem = (id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  };

  const handleExport = () => {
    if (inventory.length === 0) {
      alert("库存为空，请先添加商品。");
      return;
    }
    exportToExcel(inventory);
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-teal-400 rounded-lg flex items-center justify-center text-white shadow-md">
            <Package className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 tracking-tight">语音库存管理</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="p-2 text-primary hover:bg-teal-50 rounded-lg transition-colors flex flex-col items-center justify-center md:flex-row md:space-x-2 border border-primary/20"
              title="安装应用"
            >
              <DownloadCloud className="w-6 h-6" />
              <span className="hidden md:inline text-sm font-medium">安装</span>
            </button>
          )}

          <button 
            onClick={handleExport}
            className="p-2 text-gray-500 hover:text-primary hover:bg-teal-50 rounded-lg transition-colors flex flex-col items-center justify-center md:flex-row md:space-x-2"
            title="导出 Excel"
          >
            <FileSpreadsheet className="w-6 h-6" />
            <span className="hidden md:inline text-sm font-medium">导出</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full">
        
        {/* Stats / Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">商品总数</p>
            <p className="text-2xl font-bold text-gray-800">{inventory.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">总数量</p>
            <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
          </div>
        </div>

        {/* Charts */}
        <InventoryChart items={inventory} />

        {/* List Header & Search */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">当前列表</h2>
          <div className="relative w-40 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索商品..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Inventory List (Excel Preview) */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {inventory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-6 py-4 font-semibold">商品</th>
                    <th className="px-6 py-4 font-semibold">分类</th>
                    <th className="px-6 py-4 font-semibold text-right">数量</th>
                    <th className="px-6 py-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.productId}</div>
                        <div className="text-xs text-gray-400 md:hidden">{new Date(item.timestamp).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-medium text-gray-700">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">暂无数据</h3>
              <p className="text-gray-500 max-w-xs mx-auto mt-2">
                点击右下方的 “+” 按钮，开始使用语音添加商品。
              </p>
            </div>
          )}
        </div>
        
        {/* Safe space for FAB */}
        <div className="h-24"></div>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-16 h-16 bg-primary hover:bg-teal-800 text-white rounded-full shadow-lg shadow-teal-900/20 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      <AddItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        products={PRODUCT_DATABASE}
        onConfirm={handleAddItem}
      />
    </div>
  );
}