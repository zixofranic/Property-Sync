'use client';

import { useState } from 'react';
import { Palette, Eye } from 'lucide-react';

export function ThemeTester() {
  const [hue, setHue] = useState(220); // Default blue/purple
  const [isVisible, setIsVisible] = useState(false);

  const updateTheme = (newHue: number) => {
    setHue(newHue);
    document.documentElement.style.setProperty('--theme-hue', newHue.toString());
  };

  const presets = [
    { name: 'Ocean Blue', hue: 220, color: '#3b82f6' },
    { name: 'Forest Green', hue: 120, color: '#22c55e' },
    { name: 'Sunset Orange', hue: 30, color: '#f97316' },
    { name: 'Royal Purple', hue: 270, color: '#a855f7' },
    { name: 'Rose Pink', hue: 330, color: '#ec4899' },
    { name: 'Cyan Blue', hue: 180, color: '#06b6d4' },
  ];

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 right-4 z-50 p-3 bg-brand-primary hover:bg-brand-primary-dark text-text-super-light rounded-xl shadow-lg transition-all duration-200"
        title="Open Theme Tester"
      >
        <Palette className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-bg-secondary border border-bg-tertiary rounded-xl p-6 shadow-2xl backdrop-blur-md max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-text-super-light font-semibold flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Theme Tester
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-text-neutral hover:text-text-super-light transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Hue Slider */}
      <div className="mb-6">
        <label className="block text-text-light text-sm mb-2">
          Hue: {hue}°
        </label>
        <input
          type="range"
          min="0"
          max="360"
          value={hue}
          onChange={(e) => updateTheme(parseInt(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, 
              hsl(0, 70%, 55%), 
              hsl(60, 70%, 55%), 
              hsl(120, 70%, 55%), 
              hsl(180, 70%, 55%), 
              hsl(240, 70%, 55%), 
              hsl(300, 70%, 55%), 
              hsl(360, 70%, 55%))`
          }}
        />
      </div>

      {/* Color Presets */}
      <div className="mb-6">
        <label className="block text-text-light text-sm mb-2">Quick Presets:</label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => updateTheme(preset.hue)}
              className="p-2 rounded-lg border border-bg-tertiary hover:border-brand-primary transition-all duration-200 text-xs"
              style={{
                backgroundColor: `hsl(${preset.hue}, 15%, 12%)`,
                color: 'var(--text-light)'
              }}
            >
              <div 
                className="w-3 h-3 rounded-full mb-1 mx-auto"
                style={{ backgroundColor: `hsl(${preset.hue}, 70%, 55%)` }}
              />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Color Preview */}
      <div className="space-y-3">
        <div className="text-text-light text-sm">Live Preview:</div>
        
        {/* Background Colors */}
        <div className="flex gap-2">
          <div className="flex-1 h-8 rounded bg-bg-primary border border-bg-tertiary flex items-center justify-center text-xs text-text-neutral">
            Primary
          </div>
          <div className="flex-1 h-8 rounded bg-bg-secondary border border-bg-tertiary flex items-center justify-center text-xs text-text-neutral">
            Secondary  
          </div>
          <div className="flex-1 h-8 rounded bg-bg-tertiary border border-bg-quaternary flex items-center justify-center text-xs text-text-neutral">
            Tertiary
          </div>
        </div>

        {/* Brand Colors */}
        <div className="flex gap-2">
          <div className="flex-1 h-8 rounded bg-brand-primary flex items-center justify-center text-xs text-text-super-light font-medium">
            Primary
          </div>
          <div className="flex-1 h-8 rounded bg-brand-secondary flex items-center justify-center text-xs text-text-super-light font-medium">
            Secondary
          </div>
          <div className="flex-1 h-8 rounded bg-accent-special flex items-center justify-center text-xs text-text-super-light font-medium">
            Special
          </div>
        </div>

        {/* Text Colors */}
        <div className="bg-bg-primary rounded p-3 space-y-1">
          <div className="text-text-super-light text-sm">Super Light Text</div>
          <div className="text-text-light text-sm">Light Text</div>
          <div className="text-text-neutral text-sm">Neutral Text</div>
          <div className="text-text-dark text-sm">Dark Text</div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button className="btn-primary px-3 py-1 rounded text-xs font-medium">
            Primary
          </button>
          <button className="btn-special px-3 py-1 rounded text-xs font-medium">
            Special
          </button>
          <button className="bg-success hover:bg-success-dark px-3 py-1 rounded text-xs font-medium text-text-super-light transition-colors">
            Success
          </button>
        </div>
      </div>
    </div>
  );
}