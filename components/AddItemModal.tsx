import React, { useState, useEffect } from 'react';
import { X, Check, Search, Plus, Minus, AlertTriangle, CloudOff } from 'lucide-react';
import { VoiceRecorder } from './VoiceRecorder';
import { Product, MatchResult } from '../types';
import { matchProductFromTranscript } from '../services/geminiService';
import { matchProductLocally } from '../services/localAiService';

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
  const [usedOfflineMatch, setUsedOfflineMatch] = useState(false);

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
      setUsedOfflineMatch(false);
    }
  }, [isOpen]);

  const processMatchResult = (match: MatchResult) => {
      if (match.matchedProductId) {
        const product = products.find(p => p.id === match.matchedProductId);
        if (product) {
          setSelectedProduct(product);
          if (match.detectedQuantity) setQuantity(match.detectedQuantity);
          setStep('CONFIRM_QTY');
          return;
        }
      } 
      
      if (match.suggestions.length > 0) {
        const suggestedProducts = products.filter(p => match.suggestions.includes(p.id));
        setCandidates(suggestedProducts);
        if (match.detectedQuantity) setQuantity(match.detectedQuantity);
        setStep('SELECT_PRODUCT');
      } else {
        setCandidates(products); 
        setStep('SELECT_PRODUCT');
      }
  };

  const handleTranscript = async (text: string) => {
    setTranscript(text);
    setIsProcessing(true);
    setSearchTerm(''); 
    
    try {
      if (navigator.onLine) {
         try {
            const match = await matchProductFromTranscript(text, products);
            setUsedOfflineMatch(false);
            processMatchResult(match);
         } catch (e) {
            console.warn("Online match failed, falling back to local:", e);
            // Fallback to local if online fails (e.g. API key issue or slow network)
            const localMatch = matchProductLocally(text, products);
            setUsedOfflineMatch(true);
            processMatchResult(localMatch);
         }
      } else {
         // Offline
         const localMatch = matchProductLocally(text, products);
         setUsedOfflineMatch(true);
         processMatchResult(localMatch);
      }
    } catch (err) {
      console.error(err);
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

  const displayedProducts = searchTerm.trim() 
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : candidates;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {step === 'RECORD' ? '语音添加' : step === 'SELECT_PRODUCT' ? '选择商品' : '确认数量'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {step === 'RECORD' && (
            <div className="space-y-6">
              <VoiceRecorder onTranscript={handleTranscript} isProcessing={isProcessing} />
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-white text-sm text-gray-500">或者手动搜索</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  setCandidates(products);
                  setStep('SELECT_PRODUCT');
                }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                手动搜索 / 浏览全部
              </button>
            </div>
          )}

          {step === 'SELECT_PRODUCT' && (
            <div className="space-y-4 h-full flex flex-col">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input 
                   type="text" 
                   placeholder="输入名称或编码搜索..." 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   autoFocus
                   className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                 />
               </div>

               {transcript && !searchTerm && (
                 <div className="p-3 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-center gap-2">
                   {usedOfflineMatch ? <CloudOff className="w-4 h-4" /> : <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
                   <span>{usedOfflineMatch ? '本地匹配' : '语音识别'}: "{transcript}"</span>
                 </div>
               )}
               
               <div className="flex-1 overflow-y-auto min-h-[300px]">
                 <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                   {searchTerm ? "搜索结果" : (candidates.length === products.length ? "所有商品" : "推荐结果")}
                 </h3>
                 
                 <div className="grid gap-2 pb-4">
                   {displayedProducts.length > 0 ? displayedProducts.map(product => (
                     <button
                       key={product.id}
                       onClick={() => handleProductSelect(product)}
                       className="flex items-center justify-between p-3 border rounded-lg hover:border-primary hover:bg-teal-50 transition-all text-left group"
                     >
                       <div>
                         <div className="font-semibold text-gray-900 group-hover:text-primary">{product.name}</div>
                         <div className="text-xs text-gray-500">{product.category} • {product.id}</div>
                       </div>
                       <Plus className="w-5 h-5 text-gray-400 group-hover:text-primary" />
                     </button>
                   )) : (
                     <div className="text-center py-12 text-gray-500 flex flex-col items-center">
                       <AlertTriangle className="w-10 h-10 mb-3 text-gray-300" />
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
                <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl font-bold text-primary">{selectedProduct.name.charAt(0)}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900">{selectedProduct.name}</h3>
                <p className="text-gray-500">{selectedProduct.category}</p>
                <p className="text-xs text-gray-400 mt-1">{selectedProduct.id}</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-xl flex flex-col items-center">
                <label className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wide">数量 ({selectedProduct.unit})</label>
                <div className="flex items-center justify-center space-x-6 w-full">
                  <button 
                    onClick={decrement}
                    className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors bg-white shadow-sm active:scale-95"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={handleQuantityChange}
                      onFocus={(e) => e.target.select()}
                      className="w-32 text-center text-4xl font-bold text-gray-800 bg-transparent border-b-2 border-gray-300 focus:border-primary focus:outline-none transition-colors tabular-nums p-2"
                      style={{ appearance: 'textfield', MozAppearance: 'textfield' }} 
                    />
                  </div>

                  <button 
                    onClick={increment}
                    className="w-12 h-12 flex-shrink-0 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-500 hover:border-primary hover:text-primary transition-colors bg-white shadow-sm active:scale-95"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="w-full py-4 bg-primary hover:bg-teal-800 text-white rounded-xl font-bold text-lg shadow-lg shadow-teal-200 transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
              >
                <Check className="w-6 h-6" />
                <span>确认添加</span>
              </button>
              
              <button 
                onClick={() => setStep('SELECT_PRODUCT')}
                className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700"
              >
                更换商品
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
