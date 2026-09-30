import { useState, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';

type AlphabetType = 'russian' | 'english' | 'numbers' | 'special';

export function UniqueSymbols() {
  const { theme } = useTheme();
  const { data } = useData();
  const [activeAlphabet, setActiveAlphabet] = useState<AlphabetType>('russian');

  // Извлекаем символы из данных
  const alphabets = useMemo(() => {
    const uniqueChars = data?.summary?.uniqueChars || [];
    
    // Классифицируем символы
    const russian: string[] = [];
    const english: string[] = [];
    const numbers: string[] = [];
    const special: string[] = [];
    
    uniqueChars.forEach((char: string) => {
      if (!char || char.trim() === '') return;
      
      const code = char.charCodeAt(0);
      // Русские символы (кириллица)
      if (code >= 0x0400 && code <= 0x04FF) {
        if (!russian.includes(char)) russian.push(char);
      }
      // Английские символы (латиница)
      else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) {
        if (!english.includes(char)) english.push(char);
      }
      // Цифры
      else if (code >= 0x0030 && code <= 0x0039) {
        if (!numbers.includes(char)) numbers.push(char);
      }
      // Остальные
      else {
        if (!special.includes(char)) special.push(char);
      }
    });
    
    return {
  russian: {
    label: 'Русский',
    icon: 'RU',
        count: russian.length,
        symbols: russian.sort()
  },
  english: {
    label: 'English',
    icon: 'EN',
        count: english.length,
        symbols: english.sort()
  },
  numbers: {
    label: 'Цифры',
    icon: '123',
        count: numbers.length,
        symbols: numbers.sort()
  },
  special: {
    label: 'Спец.',
    icon: '!?',
        count: special.length,
        symbols: special.sort()
  }
};
  }, [data?.summary?.uniqueChars]);

  return (
    <div className={`rounded-xl p-5 border ${
      theme === 'dark'
        ? 'bg-[#1A1D24] border-[#2A2D35]'
        : 'bg-white border-gray-200 shadow-sm'
    }`}>
      <h3 className={`reson-overview-panel-title ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        Уникальные символы в датасете
      </h3>

      {/* Alphabet Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(alphabets) as AlphabetType[]).map((key) => {
          const alphabet = alphabets[key];
          const isActive = activeAlphabet === key;
          
          return (
            <button
              key={key}
              onClick={() => setActiveAlphabet(key)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-white text-black'
                    : 'bg-[#6366F1] text-white shadow-md'
                  : theme === 'dark'
                    ? 'bg-[#23262F] text-gray-400 hover:bg-[#2A2D35] hover:text-gray-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span className="text-xs font-medium">{alphabet.icon}</span>
              <span>{alphabet.label}</span>
            </button>
          );
        })}
      </div>

      {/* Symbols Display */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
            {alphabets[activeAlphabet].label} алфавит
          </h4>
          <span className={`text-sm ${
            theme === 'dark' ? 'text-[#60A5FA]' : 'text-[#6366F1]'
          }`}>
            {alphabets[activeAlphabet].count} символов
          </span>
        </div>

        {alphabets[activeAlphabet].symbols.length > 0 ? (
          <div className="reson-symbol-grid grid grid-cols-9 gap-1.5">
            {alphabets[activeAlphabet].symbols.map((symbol, idx) => (
              <div
                key={idx}
                className={`aspect-square rounded-lg flex items-center justify-center text-base ${
                  theme === 'dark'
                    ? 'bg-[#23262F] text-gray-300'
                    : 'bg-[#F5F5F7] text-gray-700'
                }`}
              >
                {symbol}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className={`text-xs ${
              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
            }`}>
              Нет символов в этой категории
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
