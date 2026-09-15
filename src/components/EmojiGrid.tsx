/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Search } from 'lucide-react';

interface EmojiGridProps {
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Mind & Soul',
    emojis: ['🧘', '🌬️', '📓', '❤️', '🧠', '✨', '🧘‍♂️', '🧘‍♀️', '🕯️', '🎨', '🎸', '🎮', '🧩', '💡', '🤝'],
  },
  {
    name: 'Health & Fitness',
    emojis: ['🏃', '🏋️', '🏊', '🚴', '🚶', '🤸', '🛌', '😴', '👟', '🧴', '🩹', '🚭', '🧼', '🚿', '🪥'],
  },
  {
    name: 'Food & Hydration',
    emojis: ['💧', '🥛', '🍵', '🍏', '🥗', '🥑', '🍌', '🍊', '🍉', '🥞', '🥓', '🍳', '🥤', '🧁', '🍎'],
  },
  {
    name: 'Work & Finance',
    emojis: ['📚', '💻', '💼', '📊', '💰', '🔑', '⏰', '🗓️', '✏️', '✉️', '🔋', '⚙️', '🎯', '🥇', '🏆'],
  },
  {
    name: 'Routines & Household',
    emojis: ['🛏️', '🏠', '🧹', '🧺', '👕', '🚗', '🌱', '🌳', '☀️', '🌕', '⚡', '📱', '📺', '📻', '🛠️'],
  },
];

export default function EmojiGrid({ selectedEmoji, onSelect }: EmojiGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filteredCategories = EMOJI_CATEGORIES.map((cat) => {
    const matched = cat.emojis.filter((emoji) => {
      // Emojis don't have standard letters, so we can map some words to them, 
      // or just search directly. But searching might also match categories or preset lists.
      if (!searchTerm) return true;
      // Simple lookup tags for search helpers
      const tags: { [key: string]: string } = {
        '🧘': 'meditate yoga stretch peaceful zen mind soul',
        '🌬️': 'breathe air wind mindful soul',
        '📓': 'journal write diary study personal',
        '❤️': 'love heart health care',
        '🧠': 'brain learn mind study think',
        '✨': 'magic clean shiny goals star',
        '🎨': 'paint art draw draw creative personal',
        '🎸': 'music instrument play guitar song',
        '🎮': 'game play video entertainment',
        '🧩': 'puzzle play brain build',
        '💡': 'idea light learning thinking',
        '🏃': 'run cardio jog stamina active run',
        '🏋️': 'workout muscle lift weight gym fitness',
        '🏊': 'swim cardio pool active',
        '🚴': 'bike cycle outdoor fitness',
        '🚶': 'walk steps outside dynamic active',
        '🤸': 'stretch pilates move gymnastic',
        '🛌': 'bed early rest sleep routine',
        '😴': 'sleep tired night rest',
        '🚭': 'quit smoke cigarette health',
        '🧼': 'clean wash soap personal',
        '🚿': 'shower clean morning',
        '🪥': 'brush teeth dental routine wellness',
        '💧': 'water hydrate drink glass',
        '🥛': 'milk cup hydrate drink',
        '🍵': 'tea green herbal warm',
        '🍏': 'apple fruit healthy nutrition eat',
        '🥗': 'salad healthy food diet nutrition',
        '🥑': 'avocado food diet breakfast',
        '📚': 'book study read learn deep',
        '💻': 'code software computer work screen programming developer tech',
        '💼': 'work build career job office',
        '📊': 'chart stats metrics review progress',
        '💰': 'money gold budget finance cash savings coins cost',
        '🔑': 'key secure goal access unlocking unlock',
        '⏰': 'clock alarm prompt ring morning',
        '🛏️': 'making bed neat tidy sleep',
        '🧹': 'broom sweep dust housekeeping clean',
      };
      
      const tagString = tags[emoji] || '';
      return (
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        tagString.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });

    return { ...cat, emojis: matched };
  }).filter((cat) => cat.emojis.length > 0);

  return (
    <div id="emoji-picker-container" className="flex flex-col gap-2 bg-slate-900 border border-slate-800 rounded-xl p-3 w-full">
      <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          id="emoji-search-input"
          type="text"
          placeholder="Search key e.g. meditate, read, water..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent border-0 outline-none text-xs text-slate-200 placeholder-slate-500 w-full focus:ring-0 focus:border-0"
        />
        {searchTerm && (
          <button
            id="clear-emoji-search"
            type="button"
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800 max-w-full">
        <button
          id="category-tab-all"
          type="button"
          onClick={() => { setActiveCategory('All'); setSearchTerm(''); }}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full shrink-0 transition-colors ${
            activeCategory === 'All' && !searchTerm
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
        >
          All
        </button>
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            id={`category-tab-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
            key={cat.name}
            type="button"
            onClick={() => { setActiveCategory(cat.name); setSearchTerm(''); }}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full shrink-0 transition-colors ${
              activeCategory === cat.name && !searchTerm
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="max-h-40 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-slate-800 mt-1">
        {filteredCategories
          .filter((cat) => activeCategory === 'All' || activeCategory === cat.name)
          .map((cat) => (
            <div key={cat.name} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {cat.name}
              </span>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                {cat.emojis.map((emoji) => (
                  <button
                    id={`emoji-btn-${emoji}`}
                    key={emoji}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className={`h-9 w-9 text-lg flex items-center justify-center rounded-lg transition-all ${
                      selectedEmoji === emoji
                        ? 'bg-indigo-500/30 border border-indigo-500 shadow-md transform scale-110'
                        : 'bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        {filteredCategories.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-500">
            No matching emojis found.
          </div>
        )}
      </div>
    </div>
  );
}
