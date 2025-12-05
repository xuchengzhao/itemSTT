
import React, { useState, useEffect } from 'react';
import { Plus, Package, Trash2, FileSpreadsheet, Search, DownloadCloud, Loader2, ImageOff } from 'lucide-react';
import { InventoryItem, Product } from './types';
import { PRODUCT_DATABASE } from './constants';
import { AddItemModal } from './components/AddItemModal';
import { exportToExcel } from './services/excelService';

export default function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

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
      image: product.image
    };
    // Add to top of list
    setInventory(prev => [newItem, ...prev]);
  };

  const handleRemoveItem = (id: string) => {
    setInventory(prev => prev.filter(item => item.id !== id));
  };

  const handleExport = async () => {
    if (inventory.length === 0) {
      alert("库存为空，请先添加商品。");
      return;
    }
    
    setIsExporting(true);
    try {
      // Small delay to allow UI to update to loading state
      await new Promise(resolve => setTimeout(resolve, 100));
      await exportToExcel(inventory);
    } catch (e) {
      console.error(e);
      alert("导出过程中发生未知错误");
    } finally {
      setIsExporting(false);
    }
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
      <header className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-teal-400 rounded-lg flex items-center justify-center text-white shadow-md">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 tracking-tight">语音库存</h1>
            <p className="text-xs text-primary font-medium">v0.1.2 (含图版)</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="h-10 w-10 md:w-auto md:px-3 flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/20 rounded-xl transition-all active:scale-95"
              title="安装应用"
            >
              <DownloadCloud className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline text-sm font-medium">安装</span>
            </button>
          )}

          <button 
            onClick={handleExport}
            disabled={isExporting}
            className={`h-10 w-10 md:w-auto md:px-3 flex items-center justify-center rounded-xl transition-all active:scale-95
              ${isExporting 
                ? 'bg-gray-100 text-gray-400 cursor-wait' 
                : 'text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-primary'}
            `}
            title="导出 Excel"
          >
            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileSpreadsheet className="w-5 h-5 md:mr-2" />}
            <span className="hidden md:inline text-sm font-medium">
              {isExporting ? '导出中...' : '导出'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full">
        
        {/* Stats / Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase">商品总数</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{inventory.length}</p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase">总数量</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{totalItems}</p>
          </div>
        </div>

        {/* List Header & Search */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">当前列表</h2>
          <div className="relative w-40 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="搜索..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Inventory List (Excel Preview) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {inventory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-4 font-semibold">商品信息</th>
                    <th className="px-4 py-4 font-semibold whitespace-nowrap">分类</th>
                    <th className="px-4 py-4 font-semibold text-right">数量</th>
                    <th className="px-4 py-4 font-semibold text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover mr-3 border border-gray-100 bg-gray-50" loading="lazy" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 mr-3 flex items-center justify-center border border-gray-100">
                              <Package className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 text-base">{item.name}</div>
                            <div className="text-xs text-gray-400 font-mono mt-0.5">{item.productId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono font-bold text-lg text-primary">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all p-3 rounded-full active:scale-90"
                          title="删除"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">暂无数据</h3>
              <p className="text-gray-500 max-w-xs mx-auto mt-2 text-sm">
                点击右下方的 “+” 按钮，<br/>开始使用语音添加商品。
              </p>
            </div>
          )}
        </div>
        
        {/* Safe space for FAB */}
        <div className="h-28"></div>
      </main>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-8 right-6 md:bottom-10 md:right-10 z-40">
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-16 h-16 bg-primary text-white rounded-full shadow-lg shadow-primary/30 transition-all hover:scale-105 active:scale-95 hover:bg-teal-700"
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
