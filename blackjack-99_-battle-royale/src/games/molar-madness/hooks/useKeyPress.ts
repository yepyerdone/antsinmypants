import { useEffect, useState } from 'react';

export function useKeyPress(targetKey: string) {
  const [keyPressed, setKeyPressed] = useState(false);

  useEffect(() => {
    function downHandler({ key }: KeyboardEvent) {
      if (key === targetKey || (targetKey === 'ArrowUp' && key === 'w') || (targetKey === 'ArrowDown' && key === 's') || (targetKey === 'ArrowLeft' && key === 'a') || (targetKey === 'ArrowRight' && key === 'd')) {
        setKeyPressed(true);
      }
    }

    const upHandler = ({ key }: KeyboardEvent) => {
      if (key === targetKey || (targetKey === 'ArrowUp' && key === 'w') || (targetKey === 'ArrowDown' && key === 's') || (targetKey === 'ArrowLeft' && key === 'a') || (targetKey === 'ArrowRight' && key === 'd')) {
        setKeyPressed(false);
      }
    };

    window.addEventListener('keydown', downHandler);
    window.addEventListener('keyup', upHandler);

    return () => {
      window.removeEventListener('keydown', downHandler);
      window.removeEventListener('keyup', upHandler);
    };
  }, [targetKey]);

  return keyPressed;
}
