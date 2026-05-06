import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Search } from 'lucide-react';

interface GuessInputProps {
  onGuess: (guess: string) => boolean;
  disabled?: boolean;
  isGameOver: boolean;
}

export default function GuessInput({ onGuess, disabled, isGameOver }: GuessInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && !isGameOver) {
      inputRef.current?.focus();
    }
  }, [disabled, isGameOver]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    
    if (onGuess(val)) {
      setValue('');
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-slate-500" />
      </div>
      <input
        ref={inputRef}
        type="text"
        className="block w-full pl-10 pr-3 py-4 border border-slate-800 rounded-xl bg-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white text-lg transition-all placeholder:text-slate-600"
        placeholder={isGameOver ? "Game Over!" : "Type a state name..."}
        value={value}
        onChange={handleChange}
        disabled={disabled || isGameOver}
        autoFocus
      />
    </div>
  );
}
