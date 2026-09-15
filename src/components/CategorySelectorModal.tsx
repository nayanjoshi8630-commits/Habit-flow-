/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Tag, Plus, Check, Sparkles, Folder } from 'lucide-react';
import { CATEGORY_COLORS, COLOR_ACCENTS } from '../utils/dummyData';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

interface CategorySelectorModalProps {
  selectedCategory: string;
  categoriesList: string[];
  onSelectCategory: (category: string) => void;
  onAddCategory?: (categoryName: string, color?: string) => void;
  onClose: () => void;
}

const CATEGORY_EMOJIS: { [key: string]: string } = {
  Health: '🌿',
  Mind: '🧠',
  Work: '💼',
  Personal: '🎯',
  Fitness: '🏋️',
  Finance: '💰',
  Routine: '⏰',
  Study: '📚',
  Selfcare: '🧘',
};

export default function CategorySelectorModal({
  selectedCategory,
  categoriesList,
  onSelectCategory,
  onAddCategory,
  onClose,
}: CategorySelectorModalProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('indigo');

  const handleSelect = (cat: string) => {
    try {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } catch (err) {}

    onSelectCategory(cat);
    onClose();
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const formatted = newCatName.trim();
    if (onAddCategory) {
      onAddCategory(formatted, newCatColor);
    }
    onSelectCategory(formatted);
    onClose();
  };

  return (
    <div id="category-selector-modal" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] my-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                Select Habit Category <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">
                Organize your daily routines by life area
              </p>
            </div>
          </div>

          <button
            id="close-category-modal-btn"
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4 scrollbar-thin scrollbar-thumb-slate-800">
          {/* Category Cards Grid */}
          <div className="grid grid-cols-2 gap-3">
            {categoriesList.map((cat) => {
              const isSelected = selectedCategory === cat;
              const emoji = CATEGORY_EMOJIS[cat] || '🏷️';
              const colorName = CATEGORY_COLORS[cat] || 'indigo';

              return (
                <div
                  id={`category-card-${cat}`}
                  key={cat}
                  onClick={() => handleSelect(cat)}
                  className={`relative p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-gradient-to-br from-indigo-950/80 to-slate-900 border-indigo-500/70 ring-2 ring-indigo-500/30 shadow-lg'
                      : 'bg-slate-950/60 border-slate-850 hover:border-slate-750 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl select-none">{emoji}</span>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-black text-white block">{cat}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-500 block mt-0.5">
                      {isSelected ? 'Active Category' : 'Tap to set'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Create Custom Category Toggle */}
          {!showAddForm ? (
            <button
              id="toggle-add-custom-category-btn"
              type="button"
              onClick={() => setShowAddForm(true)}
              className="mt-2 py-3 border border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 hover:bg-indigo-950/20 text-slate-400 hover:text-indigo-300 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Custom Category
            </button>
          ) : (
            <form onSubmit={handleCreateCategory} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col gap-3 animate-fadeIn">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-white">Add New Category</span>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs"
                >
                  Cancel
                </button>
              </div>

              <input
                type="text"
                placeholder="Category Name (e.g. Creative, Sleep)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                autoFocus
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl text-white font-bold text-xs outline-none"
              />

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-500">Color Theme</span>
                <div className="flex gap-2">
                  {COLOR_ACCENTS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setNewCatColor(c.name)}
                      className={`h-5 w-5 rounded-full ${c.bg} ${
                        newCatColor === c.name ? 'ring-2 ring-offset-2 ring-offset-slate-950 ring-white scale-110' : 'opacity-60'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition-all"
              >
                Save Category
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-extrabold text-xs uppercase tracking-wider rounded-2xl border border-slate-800 transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
