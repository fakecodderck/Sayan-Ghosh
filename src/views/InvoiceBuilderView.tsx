import React, { useEffect, useMemo, useState } from 'react';
import {
  GripVertical,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Save,
  Printer,
  Check,
  Sparkles,
  FilePlus2,
  Sliders,
  LayoutTemplate
} from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import {
  InvoiceBlockConfig,
  InvoiceBlockType,
  InvoiceTemplateConfig,
  TransactionVoucher
} from '../types/accounting';
import {
  INVOICE_BLOCK_PALETTE,
  STARTER_TEMPLATES,
  createBlockInstance
} from '../utils/invoiceTemplates';
import { CustomInvoiceRenderer } from '../components/CustomInvoiceRenderer';

interface InvoiceBuilderViewProps {
  onPrintVoucher?: (voucher: TransactionVoucher) => void;
}

const SAMPLE_PREVIEW_VOUCHER: TransactionVoucher = {
  id: 'preview_sample',
  voucherNo: 'INV/2026/001',
  date: new Date().toISOString().split('T')[0],
  type: 'SALE',
  partyName: 'Sample Retail Buyer',
  customerMode: 'guest',
  guestDetails: {
    name: 'Sample Retail Buyer',
    phone: '+91 98300 00000',
    address: 'Park Street, Kolkata, West Bengal',
    gstin: '19AABCS1234D1Z9',
    stateCode: '19',
  },
  isGstBill: true,
  isGstInclusive: false,
  paymentMode: 'UPI',
  subtotal: 2000,
  cgstTotal: 180,
  sgstTotal: 180,
  igstTotal: 0,
  grandTotal: 2360,
  items: [
    {
      itemId: 'sample_1',
      name: 'Standard Hardware Unit',
      hsn: '8544',
      qty: 2,
      unit: 'Pcs',
      rate: 1000,
      discount: 0,
      taxableAmount: 2000,
      gstRate: 18,
      cgst: 180,
      sgst: 180,
      igst: 0,
      total: 2360,
    },
  ],
  notes: 'Sample preview data (switch to any saved invoice above).',
};

const ACCENT_SWATCHES = ['#0f172a', '#2563eb', '#059669', '#4f46e5', '#b45309', '#be123c'];

export const InvoiceBuilderView: React.FC<InvoiceBuilderViewProps> = ({ onPrintVoucher }) => {
  const { settings, updateSettings, vouchers, getLedgerById } = useAccounting();

  const [template, setTemplate] = useState<InvoiceTemplateConfig>(() => {
    if (settings.invoiceTemplate && settings.invoiceTemplate.blocks) {
      return settings.invoiceTemplate;
    }
    return STARTER_TEMPLATES.classic_gst;
  });

  useEffect(() => {
    if (settings.invoiceTemplate && settings.invoiceTemplate.blocks) {
      setTemplate(settings.invoiceTemplate);
    }
  }, [settings.invoiceTemplate]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    () => template.blocks[0]?.id || null
  );
  const [previewVoucherId, setPreviewVoucherId] = useState<string>('');
  const [savedNotice, setSavedNotice] = useState(false);

  // Drag & Drop tracking
  const [dragPayload, setDragPayload] = useState<
    | { source: 'palette'; blockType: InvoiceBlockType }
    | { source: 'canvas'; index: number }
    | null
  >(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const invoiceVouchers = useMemo(
    () => vouchers.filter(v => ['SALE', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(v.type)),
    [vouchers]
  );

  const activePreviewVoucher = useMemo(() => {
    if (previewVoucherId) {
      return invoiceVouchers.find(v => v.id === previewVoucherId) || invoiceVouchers[0] || SAMPLE_PREVIEW_VOUCHER;
    }
    return invoiceVouchers[0] || SAMPLE_PREVIEW_VOUCHER;
  }, [previewVoucherId, invoiceVouchers]);

  const activeParty = activePreviewVoucher.partyId
    ? getLedgerById(activePreviewVoucher.partyId)
    : undefined;

  const selectedBlock = useMemo(
    () => template.blocks.find(b => b.id === selectedBlockId) || null,
    [template.blocks, selectedBlockId]
  );

  const loadPreset = (key: keyof typeof STARTER_TEMPLATES) => {
    const preset = STARTER_TEMPLATES[key];
    const cloned: InvoiceTemplateConfig = {
      ...preset,
      blocks: preset.blocks.map(b => ({
        ...b,
        id: `blk_${b.type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      })),
    };
    setTemplate(cloned);
    setSelectedBlockId(cloned.blocks[0]?.id || null);
  };

  const addBlockAt = (type: InvoiceBlockType, index?: number) => {
    const newBlock = createBlockInstance(type);
    setTemplate(prev => {
      const next = [...prev.blocks];
      if (index === undefined || index < 0 || index > next.length) {
        next.push(newBlock);
      } else {
        next.splice(index, 0, newBlock);
      }
      return { ...prev, blocks: next };
    });
    setSelectedBlockId(newBlock.id);
  };

  const moveBlock = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0 || toIdx >= template.blocks.length) return;
    setTemplate(prev => {
      const next = [...prev.blocks];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, blocks: next };
    });
  };

  const updateBlock = (blockId: string, patch: Partial<InvoiceBlockConfig>) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  };

  const removeBlock = (blockId: string) => {
    setTemplate(prev => ({
      ...prev,
      blocks: prev.blocks.filter(b => b.id !== blockId),
    }));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const handleDropAt = (targetIndex: number) => {
    if (!dragPayload) return;
    if (dragPayload.source === 'palette') {
      addBlockAt(dragPayload.blockType, targetIndex);
    } else if (dragPayload.source === 'canvas') {
      const fromIndex = dragPayload.index;
      let insertIndex = targetIndex;
      if (fromIndex < targetIndex) insertIndex -= 1;
      if (insertIndex !== fromIndex && insertIndex >= 0) {
        setTemplate(prev => {
          const next = [...prev.blocks];
          const [moved] = next.splice(fromIndex, 1);
          next.splice(insertIndex, 0, moved);
          return { ...prev, blocks: next };
        });
      }
    }
    setDragPayload(null);
    setDropTargetIndex(null);
  };

  const handleSaveTemplate = async (setAsDefault: boolean = template.useAsDefault) => {
    const toSave: InvoiceTemplateConfig = {
      ...template,
      useAsDefault: setAsDefault,
      updatedAt: new Date().toISOString(),
    };
    setTemplate(toSave);
    await updateSettings({
      ...settings,
      paperSize: toSave.paperSize,
      invoiceTemplate: toSave,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 theme-text" />
            <span>Custom Invoice Builder (Drag &amp; Drop)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Design your own invoice format from scratch by dragging blocks onto the sheet, customizing columns, and saving it for all prints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadPreset('blank')}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Start Blank</span>
          </button>

          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                loadPreset(e.target.value as keyof typeof STARTER_TEMPLATES);
              }
            }}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 theme-ring focus:outline-none"
          >
            <option value="">Load Starter Preset...</option>
            <option value="classic_gst">Classic GST Tax Invoice (A4)</option>
            <option value="compact_a5">Compact Counter Bill (A5)</option>
            <option value="modern_minimal">Modern Minimal</option>
          </select>

          {onPrintVoucher && (
            <button
              type="button"
              onClick={async () => {
                await handleSaveTemplate(true);
                onPrintVoucher(activePreviewVoucher);
              }}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save &amp; Test Print</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSaveTemplate(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg theme-bg theme-bg-hover text-white shadow-xs flex items-center gap-1.5 transition-all"
          >
            {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{savedNotice ? 'Format Saved & Active' : 'Save & Set Default'}</span>
          </button>
        </div>
      </div>

      {/* 3-Pane Drag-and-Drop Builder Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* Left Pane: Draggable Block Palette */}
        <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Invoice Elements Palette
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Drag onto canvas or click + to insert
            </p>
          </div>

          <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-0.5">
            {INVOICE_BLOCK_PALETTE.map(item => (
              <div
                key={item.type}
                draggable
                onDragStart={() => setDragPayload({ source: 'palette', blockType: item.type })}
                onDragEnd={() => {
                  setDragPayload(null);
                  setDropTargetIndex(null);
                }}
                className="group flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-400 dark:hover:border-slate-600 cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-1">
                      {item.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addBlockAt(item.type)}
                  title={`Add ${item.label}`}
                  className="p-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 theme-text hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Center Pane: Interactive Drop Canvas & Live Preview */}
        <div className="xl:col-span-6 space-y-3">
          {/* Preview toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Preview With:</span>
              <select
                value={activePreviewVoucher.id}
                onChange={e => setPreviewVoucherId(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium max-w-[210px]"
              >
                {invoiceVouchers.length === 0 ? (
                  <option value={SAMPLE_PREVIEW_VOUCHER.id}>Sample Invoice Preview</option>
                ) : (
                  invoiceVouchers.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.voucherNo} · {v.guestDetails?.name || v.partyName || 'Walk-in'}
                    </option>
                  ))
                )}
              </select>
            </div>
            <span className="font-mono tabular-nums text-[11px] text-slate-500">
              {template.paperSize} · {template.blocks.length} blocks
            </span>
          </div>

          {/* Interactive Sheet */}
          <div className="bg-slate-200/80 dark:bg-slate-950 p-3 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto flex justify-center">
            <div
              className={`w-full ${
                template.paperSize === 'A5' ? 'max-w-[540px]' : 'max-w-[700px]'
              } bg-white text-slate-900 p-4 sm:p-6 shadow-md border border-slate-300 min-h-[520px] flex flex-col`}
              onDragOver={e => {
                e.preventDefault();
                if (template.blocks.length === 0) setDropTargetIndex(0);
              }}
              onDrop={e => {
                e.preventDefault();
                if (template.blocks.length === 0) handleDropAt(0);
              }}
            >
              {template.blocks.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-8 text-center space-y-3">
                  <Sparkles className="w-8 h-8 theme-text" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">Blank Invoice Sheet</p>
                    <p className="text-xs text-slate-500 max-w-xs">
                      Drag blocks from the left palette and drop them here to build your invoice layout from scratch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadPreset('classic_gst')}
                    className="px-3.5 py-1.5 text-xs font-semibold theme-soft-badge rounded-lg hover:opacity-90"
                  >
                    Or Load Classic GST Starter
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {template.blocks.map((block, index) => {
                    const isSelected = selectedBlockId === block.id;
                    const showDropBefore = dropTargetIndex === index;

                    return (
                      <React.Fragment key={block.id}>
                        <div
                          onDragOver={e => {
                            e.preventDefault();
                            setDropTargetIndex(index);
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDropAt(index);
                          }}
                          className={`transition-all ${
                            showDropBefore
                              ? 'h-3 rounded bg-slate-500/20 border-2 border-dashed border-slate-500 my-1'
                              : 'h-1'
                          }`}
                        />

                        <div
                          draggable
                          onDragStart={() => setDragPayload({ source: 'canvas', index })}
                          onDragEnd={() => {
                            setDragPayload(null);
                            setDropTargetIndex(null);
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            setDropTargetIndex(index);
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDropAt(index);
                          }}
                          className={`group relative rounded-md border transition-all ${
                            isSelected
                              ? 'border-slate-800 ring-2 ring-slate-400/30'
                              : 'border-transparent hover:border-slate-300'
                          }`}
                        >
                          {/* Floating Block Controls */}
                          <div
                            className={`flex items-center justify-between px-2 py-1 text-[10px] rounded-t-md border-b ${
                              isSelected
                                ? 'theme-bg text-white border-transparent'
                                : 'bg-slate-100 text-slate-600 border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-semibold cursor-grab">
                              <GripVertical className="w-3 h-3" />
                              <span>{block.label}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  moveBlock(index, index - 1);
                                }}
                                disabled={index === 0}
                                className="p-0.5 hover:opacity-75 disabled:opacity-30"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  moveBlock(index, index + 1);
                                }}
                                disabled={index === template.blocks.length - 1}
                                className="p-0.5 hover:opacity-75 disabled:opacity-30"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  updateBlock(block.id, { visible: !block.visible });
                                }}
                                className="p-0.5 hover:opacity-75"
                                title={block.visible ? 'Hide Block' : 'Show Block'}
                              >
                                {block.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  removeBlock(block.id);
                                }}
                                className="p-0.5 hover:text-rose-200"
                                title="Remove Block"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="p-1.5">
                            <CustomInvoiceRenderer
                              template={{ ...template, blocks: [block] }}
                              voucher={activePreviewVoucher}
                              settings={settings}
                              party={activeParty}
                              interactive
                              selectedBlockId={selectedBlockId}
                              onSelectBlock={setSelectedBlockId}
                            />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {/* Final Drop Zone at bottom */}
                  <div
                    onDragOver={e => {
                      e.preventDefault();
                      setDropTargetIndex(template.blocks.length);
                    }}
                    onDrop={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDropAt(template.blocks.length);
                    }}
                    className={`mt-2 rounded-lg border-2 border-dashed flex items-center justify-center text-[11px] font-medium transition-all ${
                      dropTargetIndex === template.blocks.length
                        ? 'h-12 border-slate-600 bg-slate-100 text-slate-800'
                        : 'h-9 border-slate-200 text-slate-400'
                    }`}
                  >
                    Drop block here to append at bottom
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Block & Global Sheet Inspector */}
        <div className="xl:col-span-3 space-y-4">
          {/* Global Format Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3.5 text-xs">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 theme-text" />
              <span>Format Style &amp; Paper</span>
            </h3>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                Format Name
              </label>
              <input
                type="text"
                value={template.name}
                onChange={e => setTemplate(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium theme-ring focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Paper Size
                </label>
                <select
                  value={template.paperSize}
                  onChange={e =>
                    setTemplate(prev => ({ ...prev, paperSize: e.target.value as 'A5' | 'A4' }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="A5">A5 (Half)</option>
                  <option value="A4">A4 (Full)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Font Style
                </label>
                <select
                  value={template.fontFamily}
                  onChange={e =>
                    setTemplate(prev => ({
                      ...prev,
                      fontFamily: e.target.value as 'sans' | 'mono' | 'serif',
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="sans">Modern Sans</option>
                  <option value="mono">Receipt Mono</option>
                  <option value="serif">Formal Serif</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Borders
                </label>
                <select
                  value={template.borderStyle}
                  onChange={e =>
                    setTemplate(prev => ({
                      ...prev,
                      borderStyle: e.target.value as 'sharp' | 'rounded' | 'minimal',
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="sharp">Sharp</option>
                  <option value="rounded">Rounded</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Density
                </label>
                <select
                  value={template.density}
                  onChange={e =>
                    setTemplate(prev => ({
                      ...prev,
                      density: e.target.value as 'compact' | 'comfortable',
                    }))
                  }
                  className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                Print Accent Color
              </label>
              <div className="flex items-center gap-2">
                {ACCENT_SWATCHES.map(hex => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setTemplate(prev => ({ ...prev, accentColor: hex }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      template.accentColor === hex ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: hex }}
                    aria-label={`Select accent color ${hex}`}
                  />
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={template.useAsDefault}
                onChange={e => setTemplate(prev => ({ ...prev, useAsDefault: e.target.checked }))}
                className="rounded theme-text"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Use as default template when printing
              </span>
            </label>
          </div>

          {/* Selected Block Settings */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 text-xs">
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Selected Block Options</h3>

            {!selectedBlock ? (
              <p className="text-slate-400 text-[11px]">
                Click any block on the invoice sheet to customize its heading, alignment, or visible columns.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedBlock.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateBlock(selectedBlock.id, { visible: !selectedBlock.visible })}
                    className="text-[11px] font-semibold theme-text hover:underline"
                  >
                    {selectedBlock.visible ? 'Hide' : 'Show'}
                  </button>
                </div>

                {['company_header', 'bill_to', 'amount_words', 'custom_text'].includes(selectedBlock.type) && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Alignment
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['left', 'center', 'right'] as const).map(al => (
                        <button
                          key={al}
                          type="button"
                          onClick={() => updateBlock(selectedBlock.id, { align: al })}
                          className={`py-1.5 rounded-md border text-[11px] font-semibold capitalize ${
                            (selectedBlock.align || 'left') === al
                              ? 'theme-soft-badge font-bold'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {al}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {['company_header', 'bill_to', 'custom_text'].includes(selectedBlock.type) && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Custom Heading
                    </label>
                    <input
                      type="text"
                      value={selectedBlock.customHeading || ''}
                      onChange={e => updateBlock(selectedBlock.id, { customHeading: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                )}

                {selectedBlock.type === 'custom_text' && (
                  <div>
                    <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Custom Message Body
                    </label>
                    <textarea
                      rows={3}
                      value={selectedBlock.customBody || ''}
                      onChange={e => updateBlock(selectedBlock.id, { customBody: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                )}

                {selectedBlock.type === 'items_table' && (
                  <div className="space-y-2 pt-1">
                    <p className="font-medium text-slate-600 dark:text-slate-400">Visible Table Columns</p>
                    {(
                      [
                        { key: 'showHsnColumn', label: 'HSN / SAC Code', defaultVal: true },
                        { key: 'showUnitColumn', label: 'Unit (Pcs, Kg, Box)', defaultVal: true },
                        { key: 'showDiscountColumn', label: 'Discount %', defaultVal: false },
                        { key: 'showTaxColumn', label: 'GST % Rate', defaultVal: true },
                      ] as const
                    ).map(col => (
                      <label key={col.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            selectedBlock[col.key] !== undefined
                              ? Boolean(selectedBlock[col.key])
                              : col.defaultVal
                          }
                          onChange={e => updateBlock(selectedBlock.id, { [col.key]: e.target.checked })}
                          className="rounded theme-text"
                        />
                        <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {selectedBlock.type === 'bank_qr' && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlock.showQrCode !== false}
                        onChange={e => updateBlock(selectedBlock.id, { showQrCode: e.target.checked })}
                        className="rounded theme-text"
                      />
                      <span className="text-slate-700 dark:text-slate-300">Show Scannable UPI QR Code</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBlock.showBankDetails !== false}
                        onChange={e => updateBlock(selectedBlock.id, { showBankDetails: e.target.checked })}
                        className="rounded theme-text"
                      />
                      <span className="text-slate-700 dark:text-slate-300">Show Bank Account Details</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
