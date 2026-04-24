import { CRAFT_TYPES } from '../constants';
import * as Icons from 'lucide-react';
import { motion } from 'motion/react';

interface CraftSelectorProps {
  selectedId?: string;
  onSelect: (id: string) => void;
}

export default function CraftSelector({ selectedId, onSelect }: CraftSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-2xl mx-auto">
      {CRAFT_TYPES.map((craft) => {
        const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>>)[craft.icon] || Icons.Hammer;
        const isSelected = selectedId === craft.id;

        return (
          <motion.button
            key={craft.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(craft.id)}
            className={`flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all gap-2 ${
              isSelected 
                ? 'bg-primary border-primary text-white shadow-lg' 
                : 'bg-white border-primary/10 text-secondary hover:border-primary/30'
            }`}
          >
            <IconComponent size={32} strokeWidth={1.5} />
            <span className="font-bold text-lg">{craft.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
