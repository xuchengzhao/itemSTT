import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Search, Plus, Minus, AlertTriangle, Mic, Keyboard, Package, Bot, Zap, Settings, Key, Filter } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { Product, MatchResult } from '../types';
import { matchProductFromTranscript, DEFAULT_API_KEY } from '../services/modelScopeService';

interface AddItemModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, quantity: number) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  products,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [step, setStep] = useState<'RECORD' | 'SELECT_PRODUCT' | 'CONFIRM_QTY'>('RECORD');
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [useAI, setUseAI] = useState(true);
  
  // Category Filter State
  const [activeCategory, setActiveCategory] = useState('全部');

  // API Key State
  const [apiKey, setApiKey] = useState(DEFAULT_API_KEY);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Debug/Test Input State
  const [showDebug, setShowDebug] = useState(false);
  const [testInput, setTestInput] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category));
    return ['全部', ...Array.from(cats)];
  }, [products]);

  // Load API Key from local storage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('modelscope_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setStep('RECORD');
      setTranscript('');
      setCandidates([]);
      setSelectedProduct(null);
      setQuantity(1);
      setSearchTerm('');
      setIsProcessing(false);
      setUseAI(true);
      setTestInput('');
      setApiError(null);
      setShowDebug(false);
      setActiveCategory('全部');
    }
  }, [isOpen]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('modelscope_api_key', val);
    setApiError(null); // Clear error when user types
  };

  const processMatchResult = (match: MatchResult) => {
      const allIds = new Set<string>();
      if (match.matchedProductId) allIds.add(match.matchedProductId);
      match.suggestions.forEach(id => allIds.add(id));

      const matchedProducts = products.filter(p => allIds.has(p.id));

      matchedProducts.sort((a, b) => {
        if (a.id === match.matchedProductId) return -1;
        if (b.id === match.matchedProductId) return 1;
        return 0;
      });

      if (matchedProducts.length > 0) {
        setCandidates(matchedProducts);
      } else {
        setCandidates(products);
      }
      
      if (match.detectedQuantity) {
        setQuantity(match.detectedQuantity);
      } else {
        setQuantity(1);
      }

      setStep('SELECT_PRODUCT');
  };

  const handleTranscript = async (text: string) => {
    if (!text.trim()) return;
    
    setTranscript(text);
    setSearchTerm(''); 
    setActiveCategory('全部'); // Reset category on new voice input
    setApiError(null);

    // Quick Search Mode (AI Disabled)
    if (!useAI) {
      setSearchTerm(text); 
      setCandidates(products);
      setQuantity(1);
      setStep('SELECT_PRODUCT');
      return;
    }
    
    // AI Mode
    setIsProcessing(true);
    
    try {
        // Pass the current apiKey state to the service
        const match = await matchProductFromTranscript(text, products, apiKey);
        processMatchResult(match);
    } catch (e: any) {
        console.warn("Online match failed:", e);
        
        // Check for Auth Error specifically
        if (e.message && e.message.includes("401")) {
            setApiError("API Key 无效。请在下方检查并更新您的 Key。");
            setShowApiKeyInput(true); // Auto open the settings
            setIsProcessing(false);
            return; 
        }

        // Show generic error or fallback to full list
        console.error(e);
        // Fallback: show all products but keep transcript
        setCandidates(products);
        setStep('SELECT_PRODUCT');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setStep('CONFIRM_QTY');
  };

  const handleConfirm = () => {
    if (selectedProduct) {
      const finalQty = typeof quantity === 'string' ? parseInt(quantity) || 1 : Math.max(1, quantity);
      onConfirm(selectedProduct, finalQty);
      onClose();
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setQuantity('');
    } else {
      setQuantity(parseInt(val));
    }
  };

  const increment = () => {
    const current = typeof quantity === 'string' ? 0 : quantity;
    setQuantity(current + 1);
  };

  const decrement = () => {
    const current = typeof quantity === 'string' ? 0 : quantity;
    setQuantity(Math.max(1, current - 1));
  };

  // Advanced Filtering Logic
  const displayedProducts = useMemo(() => {
    // Condition to show AI results: No search term AND "All" category selected AND candidates is not the full list
    // (If candidates IS the full list, we are in manual browse mode, so we apply filters normally)
    const isAiResultMode = !searchTerm.trim() && activeCategory === '全部' && candidates.length > 0 && candidates.length !== products.length;

    if (isAiResultMode) {
        return candidates;
    }

    // Otherwise, filter the full product list (Manual Browse or Search Mode)
    return products.filter(p => {
        const matchSearch = !searchTerm.trim() || 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.id.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchCategory = activeCategory === '全部' || p.category === activeCategory;
        
        return matchSearch && matchCategory;
    });
  }, [products, candidates, searchTerm, activeCategory]);

  const isAiSuggestionMode = !searchTerm && activeCategory === '全部' && candidates.length !== products.length && candidates.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {step === 'RECORD' ? '语音添加' : step === 'SELECT_PRODUCT' ? '选择商品' : '确认数量'}
          </h2>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full transition-colors active:scale-90">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {step === 'RECORD' && (
            <div className="space-y-6">
              
              {/* AI Toggle Switch & Settings */}
              <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="flex items-center justify-center space-x-3 bg-gray-50 p-2 rounded-xl border border-gray-100 w-fit mx-auto relative">
                    <button 
                      onClick={() => setUseAI(false)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${!useAI ? 'bg-white shadow-sm text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Zap className="w-4 h-4" />
                      快速搜索
                    </button>
                    <button 
                      onClick={() => setUseAI(true)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${useAI ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Bot className="w-4 h-4" />
                      AI 智能识别
                    </button>
                  </div>

                  {/* Settings Toggles Row */}
                  <div className="flex items-center gap-4">
                      {useAI && (
                        <button 
                            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
                        >
                            <Settings className="w-3 h-3" />
                            {showApiKeyInput ? '收起配置' : '配置 Key'}
                        </button>
                      )}

                      <button 
                          onClick={() => setShowDebug(!showDebug)}
                          className={`flex items-center gap-1 text-xs transition-colors ${showDebug ? 'text-yellow-600 font-medium' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                          <Keyboard className="w-3 h-3" />
                          {showDebug ? '关闭调试' : '模拟输入'}
                      </button>
                  </div>
              </div>

              {/* API Key Input Section (Collapsible) */}
              {useAI && showApiKeyInput && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                          <Key className="w-3 h-3" />
                          ModelScope API Key
                      </label>
                      <input 
                          type="text" 
                          value={apiKey}
                          onChange={handleApiKeyChange}
                          placeholder="请输入 ms- 开头的 API Key"
                          className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono ${apiError ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-700'}`}
                      />
                      {apiError && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {apiError}
                          </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                          Key 将自动保存在本地。请使用魔搭社区 Access Token。
                      </p>
                  </div>
              )}

              <VoiceRecorder onTranscript={handleTranscript} isProcessing={isProcessing} />
              
              {/* Voice Simulation / Debug Section (Hidden by default) */}
              {showDebug && (
                <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-200 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-xs font-semibold text-yellow-700 mb-2 flex items-center gap-1">
                    <Keyboard className="w-3 h-3" />
                    模拟语音输入 (测试功能)
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder={useAI ? "例如: 两个狗套..." : "例如: 狗套..."}
                      className="flex-1 px-4 py-3 text-base border border-yellow-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-yellow-500 bg-white"
                      onKeyDown={(e) => e.key === 'Enter' && handleTranscript(testInput)}
                    />
                    <button 
                      onClick={() => handleTranscript(testInput)}
                      disabled={!testInput.trim() || isProcessing}
                      className="px-4 py-3 bg-yellow-600 text-white font-medium rounded-xl hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap active:scale-95 transition-transform"
                    >
                      识别
                    </button>
                  </div>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-3 bg-white text-sm text-gray-400">或者</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setCandidates(products);
                  setStep('SELECT_PRODUCT');
                }}
                className="w-full py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-gray-200 active:scale-[0.98]"
              >
                <Search className="w-5 h-5 text-gray-400" />
                手动浏览全部商品
              </button>
            </div>
          )}

          {step === 'SELECT_PRODUCT' && (
            <div className="space-y-3 h-full flex flex-col">
               {/* Search Bar with Mic */}
               <div className="relative shrink-0">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                 <input 
                   type="text" 
                   placeholder="搜索商品名称或编码..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full pl-10 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all text-base"
                 />
                 <button 
                   onClick={() => setStep('RECORD')}
                   className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary hover:bg-white rounded-lg transition-all"
                 >
                   <Mic className="w-5 h-5" />
                 </button>
               </div>
              
               {/* Category Filter Chips */}
               <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 no-scrollbar">
                  <Filter className="w-4 h-4 text-gray-400 shrink-0 ml-1" />
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                        activeCategory === cat
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/50 hover:text-primary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
               </div>

               {/* Transcript Status Bar */}
               {transcript && !searchTerm && activeCategory === '全部' && (
                 <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 shrink-0">
                   <Mic className="w-3 h-3" />
                   <span className="truncate">语音指令: "{transcript}"</span>
                 </div>
               )}
               
               {/* Main List */}
               <div className="flex-1 overflow-y-auto min-h-[300px]">
                 <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2 px-1">
                   {searchTerm ? "搜索结果" : (activeCategory !== '全部' ? `${activeCategory} (${displayedProducts.length})` : (isAiSuggestionMode ? "最佳匹配列表" : "所有商品"))}
                 </h3>
                 
                 <div className="grid gap-2 pb-4">
                   {displayedProducts.length > 0 ? displayedProducts.map((product, index) => (
                     <button
                       key={product.id}
                       onClick={() => handleProductSelect(product)}
                       className={`flex items-center justify-between p-4 border rounded-xl transition-all text-left group active:scale-[0.99]
                         ${(isAiSuggestionMode && index === 0) 
                            ? 'border-primary/50 bg-teal-50/50 shadow-sm ring-1 ring-primary/20' 
                            : 'hover:border-primary hover:bg-gray-50 border-gray-100'}
                       `}
                     >
                       <div className="flex items-center gap-3">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-12 h-12 rounded-lg object-cover bg-gray-50 border border-gray-100" loading="lazy" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                              <Package className="w-6 h-6" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 text-base group-hover:text-primary">{product.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{product.category} • <span className="font-mono">{product.id}</span></div>
                          </div>
                       </div>
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${(isAiSuggestionMode && index === 0) ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-primary group-hover:text-white'}`}>
                          <Plus className="w-5 h-5" />
                       </div>
                     </button>
                   )) : (
                     <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                       <AlertTriangle className="w-12 h-12 mb-3 text-gray-300" />
                       <p>未找到匹配商品</p>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          )}

          {step === 'CONFIRM_QTY' && selectedProduct && (
            <div className="space-y-6 pt-4">
              <div className="text-center">
                <div className="w-24 h-24 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-100 overflow-hidden shadow-sm">
                  {selectedProduct.image ? (
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl font-bold text-primary">{selectedProduct.name.charAt(0)}</span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900 px-4">{selectedProduct.name}</h3>
                <p className="text-sm text-gray-500 mt-1 font-mono">{selectedProduct.id}</p>
              </div>

              <div className="flex items-center justify-center space-x-6">
                <button 
                  onClick={decrement}
                  className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"
                >
                  <Minus className="w-6 h-6" />
                </button>
                
                <div className="w-24">
                  <input 
                    type="number" 
                    value={quantity}
                    onChange={handleQuantityChange}
                    className="w-full text-center text-3xl font-bold text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-primary focus:outline-none py-2"
                  />
                </div>

                <button 
                  onClick={increment}
                  className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 active:scale-90 transition-all"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setStep('SELECT_PRODUCT')}
                  className="py-4 rounded-xl font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  重选商品
                </button>
                <button 
                  onClick={handleConfirm}
                  className="py-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-secondary shadow-lg shadow-primary/30 hover:shadow-primary/40 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  确认添加
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};